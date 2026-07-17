const SUMMARY_CARDS = [
  { label: "Active products", value: "—", detail: "Add your first product" },
  { label: "Low stock", value: "—", detail: "Variant-level alerts" },
  { label: "Today’s orders", value: "—", detail: "Cash and online sales" },
] as const;

export default function StoreManagerPage() {
  return (
    <div className="manager-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Store manager</p>
          <h1>Overview</h1>
          <p>Manage the college store catalog, inventory, and counter sales.</p>
        </div>
      </header>

      <section className="summary-grid" aria-label="Store summary">
        {SUMMARY_CARDS.map((card) => (
          <article className="summary-card" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.detail}</p>
          </article>
        ))}
      </section>

      <section className="empty-panel">
        <div>
          <p className="eyebrow">Catalog setup</p>
          <h2>Build the product hierarchy</h2>
          <p>
            Create categories and their configurable attributes before adding
            product variants.
          </p>
        </div>
        <a className="primary-button" href="/store-manager/categories">
          Manage categories
        </a>
      </section>
    </div>
  );
}
