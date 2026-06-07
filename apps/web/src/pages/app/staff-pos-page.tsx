import type { Medicine } from "@pharmacy-os/types";
import { Badge, Button, Card, CardContent, EmptyState, Input, Table, Td, Th } from "@pharmacy-os/ui";
import { formatCurrency, formatDate } from "@pharmacy-os/utils";
import { useQuery } from "@tanstack/react-query";
import { Barcode, History, ReceiptIndianRupee, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";


import { PageHeader } from "../../components/page-header";
import { api, unwrap } from "../../lib/api";


export const StaffPosPage = () => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const { data: medicines = [] } = useQuery({
    queryKey: ["staff-inventory-lookup", search],
    queryFn: () => unwrap<Medicine[]>(api.get("/inventory", { params: { search, limit: 20 } })),
    placeholderData: []
  });

  const rows = useMemo(() => medicines.slice(0, 12), [medicines]);

  return (
    <section>
      <PageHeader
        title={t("nav.staff")}
        actions={
          <>
            <Button>
              <Link to="/billing" className="inline-flex items-center gap-2">
                <ReceiptIndianRupee className="h-4 w-4" /> {t("billing.saveBill")}
              </Link>
            </Button>
            <Button variant="outline">
              <Link to="/billing/history" className="inline-flex items-center gap-2">
                <History className="h-4 w-4" /> History
              </Link>
            </Button>
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-md bg-teal-50 text-teal-700 dark:bg-teal-500/10">
                <Barcode className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold">{t("billing.cart")}</h2>
                <p className="text-sm text-slate-500">Cash counter tools for billing staff.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <Button className="justify-start">
                <Link to="/billing" className="inline-flex items-center gap-2">
                  <ReceiptIndianRupee className="h-4 w-4" /> New bill
                </Link>
              </Button>
              <Button variant="outline" className="justify-start">
                <Link to="/billing/history" className="inline-flex items-center gap-2">
                  <History className="h-4 w-4" /> Reprint or mark paid
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-semibold">{t("inventory.title")}</h2>
              <Badge tone="slate">{rows.length}</Badge>
            </div>
            <div className="relative mb-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder={t("billing.medicineSearch")}
                value={search}
                onChange={(event) => { setSearch(event.target.value); }}
              />
            </div>
            {rows.length === 0 ? (
              <EmptyState title={t("common.emptyTitle")} description={t("common.emptyDescription")} />
            ) : (
              <Table>
                <thead>
                  <tr>
                    {[t("inventory.medicineName"), t("inventory.sku"), t("inventory.expiry"), t("inventory.mrp"), t("inventory.stock")].map(
                      (header) => (
                        <Th key={header}>{header}</Th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((medicine) => (
                    <tr key={medicine.id}>
                      <Td>
                        <p className="font-semibold">{medicine.name}</p>
                        <p className="text-xs text-slate-500">{medicine.manufacturer}</p>
                      </Td>
                      <Td>{medicine.sku}</Td>
                      <Td>{formatDate(medicine.expiryDate)}</Td>
                      <Td>{formatCurrency(medicine.mrp)}</Td>
                      <Td>
                        <Badge tone={medicine.stockQty <= medicine.reorderLevel ? "amber" : "teal"}>{medicine.stockQty}</Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
