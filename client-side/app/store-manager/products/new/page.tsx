import { requireStoreOperator } from "../../../../features/auth/authorization";
import { createProduct } from "../../../../features/catalog/product-actions";
import { ProductForm } from "../../../../features/store-manager/product-form";

type NewProductPageProps = Readonly<{
  searchParams: Promise<{ error?: string }>;
}>;

export default async function NewProductPage({
  searchParams,
}: NewProductPageProps) {
  const { supabase } = await requireStoreOperator();
  const params = await searchParams;
  const [categoriesResult, typesResult, valuesResult, configResult] =
    await Promise.all([
      supabase
        .from("product_categories")
        .select("id,name,parent_id")
        .eq("is_active", true)
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
        .order("sort_order"),
      supabase
        .from("category_attributes")
        .select(
          "category_id,attribute_type_id,is_required,is_variant_axis",
        )
        .eq("is_active", true)
        .order("sort_order"),
    ]);

  return (
    <div className="manager-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1>Add product</h1>
          <p>Create a product family and its first sellable variant.</p>
        </div>
      </header>
      {params.error ? <p className="notice is-error">{params.error}</p> : null}
      {(categoriesResult.data ?? []).length === 0 ? (
        <section className="empty-panel">
          <div>
            <h2>Create a category first</h2>
            <p>Products require one active category.</p>
          </div>
          <a className="primary-button" href="/store-manager/categories">
            Manage categories
          </a>
        </section>
      ) : (
        <ProductForm
          action={createProduct}
          categories={categoriesResult.data ?? []}
          attributeTypes={typesResult.data ?? []}
          attributeValues={valuesResult.data ?? []}
          categoryAttributes={configResult.data ?? []}
        />
      )}
    </div>
  );
}
