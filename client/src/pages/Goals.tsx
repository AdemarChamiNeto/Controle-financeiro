import { brl } from "@/lib/format";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Edit2, Calendar, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export default function Goals() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [calculatorData, setCalculatorData] = useState({
    targetAmount: "",
    monthlyContribution: "",
  });

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    targetAmount: "",
    currentAmount: "",
    deadline: "",
    category: "",
  });

  const { data: goals = [], refetch } = trpc.goals.list.useQuery();

  const createMutation = trpc.goals.create.useMutation({
    onSuccess: () => {
      toast.success("Meta criada com sucesso!");
      refetch();
      resetForm();
      setIsOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar meta");
    },
  });

  const updateMutation = trpc.goals.update.useMutation({
    onSuccess: () => {
      toast.success("Meta atualizada com sucesso!");
      refetch();
      resetForm();
      setIsOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar meta");
    },
  });

  const deleteMutation = trpc.goals.delete.useMutation({
    onSuccess: () => {
      toast.success("Meta deletada com sucesso!");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao deletar meta");
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      targetAmount: "",
      currentAmount: "",
      deadline: "",
      category: "",
    });
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.targetAmount) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    const payload = {
      name: formData.name,
      description: formData.description,
      targetAmount: parseFloat(formData.targetAmount),
      currentAmount: formData.currentAmount ? parseFloat(formData.currentAmount) : 0,
      deadline: formData.deadline ? new Date(formData.deadline) : undefined,
      category: formData.category,
    };

    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
  };

  const handleEdit = (goal: any) => {
    setFormData({
      name: goal.name,
      description: goal.description || "",
      targetAmount: (goal.targetAmount / 100).toString(),
      currentAmount: (goal.currentAmount / 100).toString(),
      deadline: goal.deadline ? new Date(goal.deadline).toISOString().split("T")[0] : "",
      category: goal.category || "",
    });
    setEditingId(goal.id);
    setIsOpen(true);
  };

  const calculateMonths = () => {
    if (!calculatorData.targetAmount || !calculatorData.monthlyContribution) {
      return null;
    }

    const target = parseFloat(calculatorData.targetAmount);
    const monthly = parseFloat(calculatorData.monthlyContribution);

    if (monthly <= 0) {
      return null;
    }

    const months = Math.ceil(target / monthly);
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    return { months, years, remainingMonths };
  };

  const projection = calculateMonths();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Metas Financeiras</h1>
          <p className="text-muted-foreground">Defina e acompanhe suas metas de economia</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCalculator(!showCalculator)} className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Calculadora
          </Button>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()} className="gap-2">
                <Plus className="w-4 h-4" />
                Nova Meta
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar" : "Nova"} Meta</DialogTitle>
                <DialogDescription>
                  {editingId ? "Atualize sua meta financeira" : "Crie uma nova meta de economia"}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Meta *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Viagem para Europa"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrição (opcional)"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="target">Valor Alvo (R$) *</Label>
                    <Input
                      id="target"
                      type="number"
                      step="0.01"
                      value={formData.targetAmount}
                      onChange={(e) => setFormData({ ...formData, targetAmount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="current">Valor Atual (R$)</Label>
                    <Input
                      id="current"
                      type="number"
                      step="0.01"
                      value={formData.currentAmount}
                      onChange={(e) => setFormData({ ...formData, currentAmount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="deadline">Data Limite</Label>
                    <Input
                      id="deadline"
                      type="date"
                      value={formData.deadline}
                      onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="Ex: Viagem, Casa"
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
      </div>

      {/* Calculator */}
      {showCalculator && (
        <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Calculadora de Metas
            </CardTitle>
            <CardDescription>Calcule quanto tempo levará para atingir sua meta</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="calc-target">Valor Alvo (R$)</Label>
                  <Input
                    id="calc-target"
                    type="number"
                    step="0.01"
                    value={calculatorData.targetAmount}
                    onChange={(e) => setCalculatorData({ ...calculatorData, targetAmount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="calc-monthly">Contribuição Mensal (R$)</Label>
                  <Input
                    id="calc-monthly"
                    type="number"
                    step="0.01"
                    value={calculatorData.monthlyContribution}
                    onChange={(e) => setCalculatorData({ ...calculatorData, monthlyContribution: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {projection && (
                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-lg">Projeção</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Tempo total:</span>
                      <span className="font-bold text-lg">
                        {projection.years > 0 && `${projection.years}a `}
                        {projection.remainingMonths}m
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Total de meses:</span>
                      <span className="font-bold">{projection.months}</span>
                    </div>
                    <div className="pt-2 border-t border-border">
                      <p className="text-sm text-muted-foreground">
                        Economizando {brl(parseFloat(calculatorData.monthlyContribution))} por mês, você atingirá
                        {brl(parseFloat(calculatorData.targetAmount))} em aproximadamente{" "}
                        <span className="font-semibold text-foreground">
                          {projection.years > 0 && `${projection.years} ano${projection.years > 1 ? "s" : ""} e `}
                          {projection.remainingMonths} mês{projection.remainingMonths > 1 ? "es" : ""}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goals List */}
      <div className="space-y-4">
        {goals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Nenhuma meta criada ainda</p>
              <p className="text-sm text-muted-foreground mt-1">Crie sua primeira meta para começar a poupar</p>
            </CardContent>
          </Card>
        ) : (
          goals.map((goal) => {
            const progress = (goal.currentAmount / goal.targetAmount) * 100;
            const daysLeft = goal.deadline
              ? Math.ceil((new Date(goal.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
              : null;

            return (
              <Card key={goal.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-1">{goal.name}</CardTitle>
                      {goal.description && (
                        <CardDescription>{goal.description}</CardDescription>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        {goal.category && <span>📁 {goal.category}</span>}
                        {daysLeft !== null && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {daysLeft > 0 ? `${daysLeft} dias` : "Prazo expirado"}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(goal)}
                        className="p-2 hover:bg-muted rounded transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate({ id: goal.id })}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Progresso</span>
                      <span className="font-medium">{progress.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-blue-600 to-purple-600 h-3 rounded-full transition-all"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{brl((goal.currentAmount / 100))}</span>
                      <span>{brl((goal.targetAmount / 100))}</span>
                    </div>
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground">
                        Faltam <span className="font-semibold text-foreground">{brl(((goal.targetAmount - goal.currentAmount) / 100))}</span> para atingir a meta
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
