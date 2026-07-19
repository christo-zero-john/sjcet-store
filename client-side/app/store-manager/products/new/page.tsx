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
        .select("id,name,parent_id,description")
        .eq("is_active", true)
        .order("sort_order")
        .order("name"),
      supabase
        .from("attribute_types")
        .select("id,name")
        .order("name"),
      supabase
        .from("attribute_values")
        .select("id,attribute_type_id,value,sort_order")
        .order("sort_order"),
      supabase
        .from("category_attributes")
        .select(
          "category_id,attribute_type_id,is_required,is_variant_axis,sort_order,required_from",
        )
        .order("sort_order"),
    ]);

  return (
    <div className="manager-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1>Add product</h1>
          <p>Create the product family and all sellable variants you stock.</p>
        </div>
      </header>
      {params.error ? <p className="notice is-error">{params.error}</p> : null}
      <ProductForm
        action={createProduct}
        categories={categoriesResult.data ?? []}
        attributeTypes={typesResult.data ?? []}
        attributeValues={valuesResult.data ?? []}
        categoryAttributes={configResult.data ?? []}
      />
    </div>
  );
}
