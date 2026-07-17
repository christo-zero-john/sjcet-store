import {
  assignCategoryAttribute,
  createAttributeType,
  createAttributeValue,
  createCategory,
} from "../../../features/catalog/actions";
import { requireStoreOperator } from "../../../features/auth/authorization";

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

type CategoriesPageProps = Readonly<{
  searchParams: Promise<{ error?: string }>;
}>;

export default async function CategoriesPage({
  searchParams,
}: CategoriesPageProps) {
  const { supabase } = await requireStoreOperator();
  const params = await searchParams;
  const [categoriesResult, typesResult, valuesResult] = await Promise.all([
    supabase
      .from("product_categories")
      .select("id,parent_id,name,description,is_active")
      .order("sort_order")
      .order("name"),
    supabase
      .from("attribute_types")
      .select("id,name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("attribute_values")
      .select("id,attribute_type_id,value")
      .eq("is_active", true)
      .order("sort_order")
      .order("value"),
  ]);

  const categories = (categoriesResult.data ?? []) as Category[];
  const attributeTypes = (typesResult.data ?? []) as AttributeType[];
  const attributeValues = (valuesResult.data ?? []) as AttributeValue[];
  const roots = categories.filter((category) => category.parent_id === null);

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
                <strong>{type.name}</strong>
                <div>
                  {attributeValues
                    .filter((value) => value.attribute_type_id === type.id)
                    .map((value) => (
                      <span key={value.id}>{value.value}</span>
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
    </div>
  );
}
