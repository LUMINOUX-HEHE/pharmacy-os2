import type { Customer } from "@pharmacy-os/types";
import { Badge, Button, Card, CardContent, Input, Modal, Table, Td, Th } from "@pharmacy-os/ui";
import { formatCurrency, formatDate } from "@pharmacy-os/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader } from "../../components/page-header";
import { api, unwrap } from "../../lib/api";

type CustomerFilter = "active" | "dormant" | "creditPending";

interface CustomerRow extends Customer {
  lastVisit: string | null;
  totalSpend: number;
}

interface CustomerForm {
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
}

const filters: { key: CustomerFilter; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "dormant", label: "Dormant" },
  { key: "creditPending", label: "Credit Pending" }
];

export const CustomersPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<CustomerFilter>("active");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const form = useForm<CustomerForm>({ defaultValues: { name: "", phone: "", email: "", address: "" } });

  useEffect(() => {
    const handle = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const customersQuery = useQuery({
    queryKey: ["customers", filter, search],
    queryFn: () => unwrap<CustomerRow[]>(api.get("/customers", { params: { filter, search: search || undefined, limit: 100 } })),
    placeholderData: []
  });

  const createCustomer = useMutation({
    mutationFn: (values: CustomerForm) => unwrap(api.post("/customers", { ...values, tags: [] })),
    onSuccess: async () => {
      toast.success("Customer created");
      setOpen(false);
      form.reset({ name: "", phone: "", email: "", address: "" });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: () => toast.error("Customer could not be created")
  });

  const customers = customersQuery.data ?? [];

  return (
    <section>
      <PageHeader
        title={t("modules.customers")}
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {t("common.add")}</Button>}
      />

      <Card>
        <CardContent>
          <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto]">
            <Input placeholder="Search by name or phone" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
            <div className="flex flex-wrap gap-2">
              {filters.map((item) => (
                <Button key={item.key} variant={filter === item.key ? "primary" : "outline"} onClick={() => setFilter(item.key)}>
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          <Table>
            <thead>
              <tr>{["Name", "Phone", "Last Visit", "Total Spend", "Credit Balance", "Tags"].map((header) => <Th key={header}>{header}</Th>)}</tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr
                  key={customer.id}
                  className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-900"
                  onClick={() => navigate(`/customers/${customer.id}`)}
                >
                  <Td className="font-semibold text-navy-950 dark:text-white">{customer.name}</Td>
                  <Td>{customer.phone}</Td>
                  <Td>{customer.lastVisit ? formatDate(customer.lastVisit) : "No purchase"}</Td>
                  <Td>{formatCurrency(customer.totalSpend)}</Td>
                  <Td>{formatCurrency(customer.creditBalance)}</Td>
                  <Td>{customer.tags.map((tag) => <Badge key={tag} tone="teal" className="mr-1">{tag}</Badge>)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} title="Add Customer" onClose={() => setOpen(false)}>
        <form className="grid gap-4" onSubmit={form.handleSubmit((values) => createCustomer.mutate(values))}>
          <Input placeholder="Name" {...form.register("name", { required: true })} />
          <Input placeholder="Phone" {...form.register("phone", { required: true })} />
          <Input placeholder="Email" {...form.register("email")} />
          <Input placeholder="Address" {...form.register("address")} />
          <Button type="submit" disabled={createCustomer.isPending}>{t("common.save")}</Button>
        </form>
      </Modal>
    </section>
  );
};
