import { createFileRoute } from "@tanstack/react-router";
import { Catalog, catalogQuery, validateCatalogSearch } from "~/components/trucks/catalog";
import { dictFor } from "~/i18n";
import { useT } from "~/lib/i18n";
import { seo } from "~/lib/seo";
import type { Lang } from "~/shared/domain";

export const Route = createFileRoute("/$lang/sale")({
  validateSearch: validateCatalogSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(catalogQuery(deps, "sale")),
  head: ({ params }) => {
    const lang = params.lang as Lang;
    const t = dictFor(lang);
    return seo({ lang, path: "/sale", title: t.meta.sale.title, description: t.meta.sale.description });
  },
  component: SalePage,
});

function SalePage() {
  const t = useT();
  return <div className="container-page py-12">
    <header className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-wider text-flag-500">{t.nav.sale}</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t.catalog.saleTitle}</h1>
      <p className="mt-3 text-lg text-muted">{t.catalog.saleText}</p>
    </header>
    <div className="mt-10"><Catalog search={Route.useSearch()} lockedMode="sale" /></div>
  </div>;
}
