import { brl } from "@/lib/format";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Wallet, Target } from "lucide-react";
import { useState, useMemo } from "react";

export default function Dashboard() {
  const { user } = useAuth();
  const [currentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // Fetch data
  const { data: transactions = [] } = trpc.transactions.list.useQuery({
    startDate: new Date(year, month - 1, 1),
    endDate: new Date(year, month, 0, 23, 59, 59),
  });

  const { data: categories = [] } = trpc.categories.list.useQuery();
  const { data: budgets = [] } = trpc.budgets.list.useQuery({ year, month });
  const { data: goals = [] } = trpc.goals.list.useQuery();

  // Calculate metrics
  const metrics = useMemo(() => {
    const income = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0) / 100;

    const expenses = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0) / 100;

    const balance = income - expenses;

    return { income, expenses, balance };
  }, [transactions]);

  // Prepare chart data
  const categoryData = useMemo(() => {
    return categories.map((cat) => {
      const catTransactions = transactions.filter((t) => t.categoryId === cat.id);
      const amount = catTransactions.reduce((sum, t) => sum + t.amount, 0) / 100;
      return {
        name: cat.name,
        value: amount,
        color: cat.color,
      };
    });
  }, [categories, transactions]);

  // Monthly trend data (last 6 months)
  const monthlyData = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1);
      const monthStr = d.toLocaleDateString("pt-BR", { month: "short" });
      data.push({ month: monthStr, income: 0, expenses: 0 });
    }
    return data;
  }, [year, month]);

  // Goals progress
  const goalsProgress = useMemo(() => {
    return goals.map((goal) => ({
      ...goal,
      progress: (goal.currentAmount / goal.targetAmount) * 100,
    }));
  }, [goals]);

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 text-white shadow-lg">
        <h1 className="text-3xl font-bold mb-2">Bem-vindo, {user?.name}!</h1>
        <p className="text-blue-100">Aqui está um resumo da sua situação financeira</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Receitas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              {brl(metrics.income)}
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Este mês</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-900 dark:text-red-100 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              Despesas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-300">
              {brl(metrics.expenses)}
            </div>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">Este mês</p>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${
          metrics.balance >= 0
            ? "from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700"
            : "from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-700"
        }`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Saldo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${metrics.balance >= 0 ? "text-blue-700 dark:text-blue-300" : "text-orange-700 dark:text-orange-300"}`}>
              {brl(metrics.balance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Receitas - Despesas</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-purple-900 dark:text-purple-100 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Metas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
              {goals.length}
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Metas ativas</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expenses by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Despesas por Categoria</CardTitle>
            <CardDescription>Distribuição das despesas do mês</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData.filter((d) => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${brl(value)}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => `${brl(Number(value))}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Tendência Mensal</CardTitle>
            <CardDescription>Evolução de receitas e despesas</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: any) => `${brl(Number(value))}`} />
                <Legend />
                <Bar dataKey="income" fill="#10b981" name="Receitas" />
                <Bar dataKey="expenses" fill="#ef4444" name="Despesas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Goals Progress */}
      {goals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Progresso das Metas</CardTitle>
            <CardDescription>Acompanhe suas metas financeiras</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {goalsProgress.map((goal) => (
                <div key={goal.id} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-sm">{goal.name}</h4>
                    <span className="text-sm text-muted-foreground">
                      {goal.progress.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(goal.progress, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{brl((goal.currentAmount / 100))}</span>
                    <span>{brl((goal.targetAmount / 100))}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
