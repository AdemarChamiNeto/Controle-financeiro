import { brl } from "@/lib/format";
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Edit2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function Budgets() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [formData, setFormData] = useState({
    categoryId: "",
    limit: "",
    alertPercentage: "80",
  });

  const { data: budgets = [], refetch } = trpc.budgets.list.useQuery({
    year: selectedYear,
    month: selectedMonth,
  });

  const { data: categories = [] } = trpc.categories.list.useQuery();
  const { data: transactions = [] } = trpc.transactions.list.useQuery({
    startDate: new Date(selectedYear, selectedMonth - 1, 1),
    endDate: new Date(selectedYear, selectedMonth, 0, 23, 59, 59),
  });

  const createMutation = trpc.budgets.create.useMutation({
    onSuccess: () => {
      toast.success("Orçamento criado com sucesso!");
      refetch();
      resetForm();
      setIsOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar orçamento");
    },
  });

  const updateMutation = trpc.budgets.update.useMutation({
    onSuccess: () => {
      toast.success("Orçamento atualizado com sucesso!");
      refetch();
      resetForm();
      setIsOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar orçamento");
    },
  });

  const deleteMutation = trpc.budgets.delete.useMutation({
    onSuccess: () => {
      toast.success("Orçamento deletado com sucesso!");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao deletar orçamento");
    },
  });

  const resetForm = () => {
    setFormData({
      categoryId: "",
      limit: "",
      alertPercentage: "80",
    });
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.categoryId || !formData.limit) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const payload = {
      categoryId: parseInt(formData.categoryId),
      year: selectedYear,
      month: selectedMonth,
      limit: parseFloat(formData.limit),
      alertPercentage: parseInt(formData.alertPercentage),
    };

    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
  };

  const handleEdit = (budget: any) => {
    setFormData({
      categoryId: budget.categoryId.toString(),
      limit: (budget.limit / 100).toString(),
      alertPercentage: budget.alertPercentage.toString(),
    });
    setEditingId(budget.id);
    setIsOpen(true);
  };

  const getCategoryName = (categoryId: number) => {
    return categories.find((c) => c.id === categoryId)?.name || "Sem categoria";
  };

  const getCategoryColor = (categoryId: number) => {
    return categories.find((c) => c.id === categoryId)?.color || "#3B82F6";
  };

  // Calculate spent amount per category
  const categorySpending = useMemo(() => {
    const spending: Record<number, number> = {};
    transactions.forEach((t) => {
      if (t.type === "expense") {
        spending[t.categoryId] = (spending[t.categoryId] || 0) + t.amount;
      }
    });
    return spending;
  }, [transactions]);

  // Enrich budgets with spending info
  const budgetsWithSpending = useMemo(() => {
    return budgets.map((budget) => {
      const spent = categorySpending[budget.categoryId] || 0;
      const percentage = (spent / budget.limit) * 100;
      const isAlert = percentage >= budget.alertPercentage;

      return {
        ...budget,
        spent,
        percentage,
        isAlert,
      };
    });
  }, [budgets, categorySpending]);

  const months = [
    { value: 1, label: "Janeiro" },
    { value: 2, label: "Fevereiro" },
    { value: 3, label: "Março" },
    { value: 4, label: "Abril" },
    { value: 5, label: "Maio" },
    { value: 6, label: "Junho" },
    { value: 7, label: "Julho" },
    { value: 8, label: "Agosto" },
    { value: 9, label: "Setembro" },
    { value: 10, label: "Outubro" },
    { value: 11, label: "Novembro" },
    { value: 12, label: "Dezembro" },
  ];

  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - 1 + i);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Orçamentos</h1>
          <p className="text-muted-foreground">Defina limites de gastos por categoria</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()} className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Orçamento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar" : "Novo"} Orçamento</DialogTitle>
              <DialogDescription>
                {editingId ? "Atualize o orçamento" : "Crie um novo orçamento mensal"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoria *</Label>
                <Select value={formData.categoryId} onValueChange={(value) => setFormData({ ...formData, categoryId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="limit">Limite (R$) *</Label>
                  <Input
                    id="limit"
                    type="number"
                    step="0.01"
                    value={formData.limit}
                    onChange={(e) => setFormData({ ...formData, limit: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="alert">Alerta (%)</Label>
                  <Input
                    id="alert"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.alertPercentage}
                    onChange={(e) => setFormData({ ...formData, alertPercentage: e.target.value })}
                    placeholder="80"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Month/Year Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Budgets List */}
      <div className="space-y-4">
        {budgetsWithSpending.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Nenhum orçamento criado para este período</p>
            </CardContent>
          </Card>
        ) : (
          budgetsWithSpending.map((budget) => (
            <Card key={budget.id} className={budget.isAlert ? "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/10" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-base">{getCategoryName(budget.categoryId)}</CardTitle>
                      {budget.isAlert && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded text-xs font-medium">
                          <AlertCircle className="w-3 h-3" />
                          Alerta
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Limite: {brl((budget.limit / 100))} | Gasto: {brl((budget.spent / 100))}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(budget)}
                      className="p-2 hover:bg-muted rounded transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate({ id: budget.id })}
                      className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progresso</span>
                    <span className="font-medium">{budget.percentage.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        budget.percentage >= 100
                          ? "bg-red-600"
                          : budget.isAlert
                          ? "bg-orange-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
