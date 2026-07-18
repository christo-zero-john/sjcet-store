import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CategoryInlinePanel } from "./category-inline-panel";

describe("inline category hierarchy", () => {
  it("lets a subcategory draft create its missing parent in place", () => {
    const markup = renderToStaticMarkup(
      <CategoryInlinePanel
        attributeTypes={[]}
        categories={[
          { id: "stationery", name: "Stationery", parent_id: null },
        ]}
        mode="subcategory"
        onClose={() => undefined}
        onCreated={() => undefined}
      />,
    );

    expect(markup).toContain("Add new subcategory");
    expect(markup).toContain("Parent category");
    expect(markup).toContain("+ Create parent category");
    expect(markup).toContain("Subcategory name");
    expect(markup).not.toContain("Grandparent");
  });

  it("reuses the category drawer with prefilled edit fields", () => {
    const markup = renderToStaticMarkup(
      <CategoryInlinePanel
        attributeTypes={[]}
        categories={[
          {
            id: "stationery",
            name: "Stationery",
            parent_id: null,
            description: "College supplies",
          },
        ]}
        category={{
          id: "stationery",
          name: "Stationery",
          parent_id: null,
          description: "College supplies",
        }}
        intent="edit"
        mode="parent"
        onClose={() => undefined}
        onCreated={() => undefined}
      />,
    );

    expect(markup).toContain("Edit parent category");
    expect(markup).toContain('value="Stationery"');
    expect(markup).toContain("College supplies");
    expect(markup).toContain("Save changes");
    expect(markup).not.toContain("Save and select parent category");
  });
});
