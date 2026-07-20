type ModulePlaceholderProps = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
}>;

export function ModulePlaceholder({
  eyebrow,
  title,
  description,
}: ModulePlaceholderProps) {
  return (
    <div className="manager-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </header>
      <section className="empty-panel">
        <div>
          <h2>This module has its own delivery plan</h2>
          <p>
            Inventory work stays available from Products and Inventory while
            this module is completed independently.
          </p>
        </div>
      </section>
    </div>
  );
}
