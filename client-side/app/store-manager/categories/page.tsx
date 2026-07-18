import {
  assignCategoryAttribute,
  createAttributeType,
  createAttributeValue,
  createCategory,
  removeAttributeType,
  removeAttributeValue,
  removeCategoryAttribute,
} from "../../../features/catalog/actions";
import type { CatalogOptionUsage } from "../../../features/catalog/contracts";
import { requireStoreOperator } from "../../../features/auth/authorization";
import { ConfirmSubmitButton } from "../../../features/store-manager/confirm-submit-button";

type Category = {
  id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
};

type AttributeType = {
  id: string;
  name: string;
};

type AttributeValue = {
  id: string;
  attribute_type_id: string;
  value: string;
};
type CategoryAttribute = {
  category_id: string;
  attribute_type_id: string;
  is_required: boolean;
  is_variant_axis: boolean;
};
type ProductReference = { id: string; category_id: string };

type CategoriesPageProps = Readonly<{
  searchParams: Promise<{ error?: string }>;
}>;

export default async function CategoriesPage({
  searchParams,
}: CategoriesPageProps) {
  const { supabase } = await requireStoreOperator();
  const params = await searchParams;
  const [categoriesResult, typesResult, valuesResult, configResult, productsResult] =
    await Promise.all([
    supabase
      .from("product_categories")
      .select("id,parent_id,name,description,is_active")
      .order("sort_order")
      .order("name"),
    supabase
      .from("attribute_types")
      .select("id,name")
      .order("name"),
    supabase
      .from("attribute_values")
      .select("id,attribute_type_id,value")
      .order("sort_order")
      .order("value"),
    supabase
      .from("category_attributes")
      .select("category_id,attribute_type_id,is_required,is_variant_axis")
      .order("sort_order"),
    supabase.from("products").select("id,category_id"),
  ]);

  const categories = (categoriesResult.data ?? []) as Category[];
  const attributeTypes = (typesResult.data ?? []) as AttributeType[];
  const attributeValues = (valuesResult.data ?? []) as AttributeValue[];
  const configurations = (configResult.data ?? []) as CategoryAttribute[];
  const products = (productsResult.data ?? []) as ProductReference[];
  const roots = categories.filter((category) => category.parent_id === null);
  const usageEntries = await Promise.all(
    [
      ...attributeTypes.map((type) => ({
        key: `type:${type.id}`,
        typeId: type.id,
        valueId: null,
      })),
      ...attributeValues.map((value) => ({
        key: `value:${value.id}`,
        typeId: value.attribute_type_id,
        valueId: value.id,
      })),
    ].map(async (target) => {
      const { data } = await supabase.rpc("get_catalog_option_usage", {
        target_attribute_type_id: target.typeId,
        target_attribute_value_id: target.valueId,
      });
      return [target.key, data as CatalogOptionUsage | null] as const;
    }),
  );
  const usage = new Map(usageEntries);

  return (
    <div className="manager-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Catalog configuration</p>
          <h1>Categories & attributes</h1>
          <p>
            Build a two-level category tree and define the fields used by each
            product form.
          </p>
        </div>
      </header>

      {params.error ? <p className="notice is-error">{params.error}</p> : null}

      <div className="catalog-grid">
        <section className="workspace-card">
          <div className="section-heading">
            <div>
              <span>Hierarchy</span>
              <h2>Product categories</h2>
            </div>
            <strong>{categories.length}</strong>
          </div>

          <div className="category-tree">
            {roots.length === 0 ? (
              <p className="muted">No categories yet. Add the first one below.</p>
            ) : (
              roots.map((root) => (
                <article className="category-node" key={root.id}>
                  <div>
                    <strong>{root.name}</strong>
                    <span>{root.description || "Root category"}</span>
                  </div>
                  <div className="subcategory-list">
                    {categories
                      .filter((category) => category.parent_id === root.id)
                      .map((category) => (
                        <div key={category.id}>
                          <span>{category.name}</span>
                        </div>
                      ))}
                  </div>
                </article>
              ))
            )}
          </div>

          <form action={createCategory} className="stack-form">
            <h3>Add category</h3>
            <label>
              Name
              <input name="name" required />
            </label>
            <label>
              Parent
              <select name="parentId">
                <option value="">Root category</option>
                {roots.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Description
              <textarea name="description" rows={2} />
            </label>
            <button className="primary-button" type="submit">
              Add category
            </button>
          </form>
        </section>

        <section className="workspace-card">
          <div className="section-heading">
            <div>
              <span>Dynamic fields</span>
              <h2>Attributes & values</h2>
            </div>
            <strong>{attributeTypes.length}</strong>
          </div>

          <div className="attribute-list">
            {attributeTypes.map((type) => (
              <article key={type.id}>
                <div className="attribute-heading">
                  <strong>{type.name}</strong>
                  {(() => {
                    const typeUsage = usage.get(`type:${type.id}`);
                    const inUse = Boolean(typeUsage?.total_count);
                    return (
                      <form action={removeAttributeType}>
                        <input name="attributeTypeId" type="hidden" value={type.id} />
                        <ConfirmSubmitButton
                          className="text-button"
                          disabled={inUse}
                          message={`Remove the ${type.name} parameter permanently?`}
                          title={
                            inUse
                              ? `Used by ${typeUsage?.product_count ?? 0} products and ${typeUsage?.category_count ?? 0} categories`
                              : "Remove parameter"
                          }
                        >
                          Remove
                        </ConfirmSubmitButton>
                      </form>
                    );
                  })()}
                </div>
                <div>
                  {attributeValues
                    .filter((value) => value.attribute_type_id === type.id)
                    .map((value) => (
                      <span className="attribute-value" key={value.id}>
                        {value.value}
                        {(() => {
                          const valueUsage = usage.get(`value:${value.id}`);
                          const inUse = Boolean(valueUsage?.total_count);
                          return (
                            <form action={removeAttributeValue}>
                              <input
                                name="attributeValueId"
                                type="hidden"
                                value={value.id}
                              />
                              <ConfirmSubmitButton
                                aria-label={`Remove ${value.value}`}
                                className="text-button"
                                disabled={inUse}
                                message={`Remove the ${value.value} value permanently?`}
                                title={
                                  inUse
                                    ? `Used by ${valueUsage?.variant_count ?? 0} variants`
                                    : "Remove value"
                                }
                              >
                                ×
                              </ConfirmSubmitButton>
                            </form>
                          );
                        })()}
                      </span>
                    ))}
                </div>
              </article>
            ))}
          </div>

          <form action={createAttributeType} className="stack-form compact-form">
            <h3>Create attribute</h3>
            <label>
              Name
              <input name="name" placeholder="Size, Color, Material…" required />
            </label>
            <button className="secondary-button" type="submit">
              Create attribute
            </button>
          </form>

          <form action={createAttributeValue} className="stack-form compact-form">
            <h3>Add allowed value</h3>
            <label>
              Attribute
              <select name="attributeTypeId" required>
                <option value="">Choose attribute</option>
                {attributeTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Value
              <input name="value" placeholder="Example: Medium" required />
            </label>
            <button className="secondary-button" type="submit">
              Add value
            </button>
          </form>
        </section>
      </div>

      <section className="workspace-card full-width-card">
        <div className="section-heading">
          <div>
            <span>Product form rules</span>
            <h2>Assign an attribute to a category</h2>
          </div>
        </div>
        <form action={assignCategoryAttribute} className="inline-config-form">
          <label>
            Category
            <select name="categoryId" required>
              <option value="">Choose category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.parent_id ? "↳ " : ""}
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Attribute
            <select name="attributeTypeId" required>
              <option value="">Choose attribute</option>
              {attributeTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>
          <label className="check-field">
            <input name="isRequired" type="checkbox" />
            Required
          </label>
          <label className="check-field">
            <input name="isVariantAxis" type="checkbox" />
            Defines variants
          </label>
          <button className="primary-button" type="submit">
            Save configuration
          </button>
        </form>
      </section>

      <section className="workspace-card full-width-card">
        <div className="section-heading">
          <div>
            <span>Current rules</span>
            <h2>Category parameters</h2>
          </div>
        </div>
        <div className="configuration-list">
          {configurations.map((configuration) => {
            const category = categories.find(
              (item) => item.id === configuration.category_id,
            );
            const type = attributeTypes.find(
              (item) => item.id === configuration.attribute_type_id,
            );
            const categoryIds = new Set([
              configuration.category_id,
              ...categories
                .filter(
                  (item) => item.parent_id === configuration.category_id,
                )
                .map((item) => item.id),
            ]);
            const referencedProductIds =
              usage
                .get(`type:${configuration.attribute_type_id}`)
                ?.product_ids.filter((productId) =>
                  products.some(
                    (product) =>
                      product.id === productId &&
                      categoryIds.has(product.category_id),
                  ),
                ) ?? [];
            const inUse = referencedProductIds.length > 0;

            return (
              <article key={`${configuration.category_id}:${configuration.attribute_type_id}`}>
                <div>
                  <strong>{category?.name}</strong>
                  <span>
                    {type?.name} ·{" "}
                    {configuration.is_variant_axis ? "Variant option" : "Product detail"}
                    {configuration.is_required ? " · Required" : ""}
                  </span>
                </div>
                <form action={removeCategoryAttribute}>
                  <input
                    name="categoryId"
                    type="hidden"
                    value={configuration.category_id}
                  />
                  <input
                    name="attributeTypeId"
                    type="hidden"
                    value={configuration.attribute_type_id}
                  />
                  <ConfirmSubmitButton
                    className="text-button"
                    disabled={inUse}
                    message={`Remove ${type?.name ?? "this parameter"} from ${category?.name ?? "this category"}?`}
                    title={
                      inUse
                        ? `Used by ${referencedProductIds.length} products`
                        : "Remove from category"
                    }
                  >
                    Remove
                  </ConfirmSubmitButton>
                </form>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
