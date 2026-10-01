import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, LogOut, Shield } from "lucide-react";

export default function Settings() {
  const { user, logout } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Gerencie suas preferências e dados pessoais</p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Perfil
          </CardTitle>
          <CardDescription>Informações da sua conta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Nome</label>
              <p className="text-lg font-semibold mt-1">{user?.name || "Não informado"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <p className="text-lg font-semibold mt-1">{user?.email || "Não informado"}</p>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground mb-3">
              Sua conta foi criada em {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("pt-BR") : "data desconhecida"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Security Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Segurança
          </CardTitle>
          <CardDescription>Gerencie a segurança da sua conta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Autenticação Segura</h4>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Sua senha é armazenada com hash bcrypt e a sessão fica em um cookie httpOnly que expira em 7 dias.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Logout Section */}
      <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <LogOut className="w-5 h-5" />
            Sair da Conta
          </CardTitle>
          <CardDescription>Encerre sua sessão atual</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => logout()}
            variant="destructive"
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            Fazer Logout
          </Button>
        </CardContent>
      </Card>

      {/* Info Section */}
      <Card className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-800">
        <CardHeader>
          <CardTitle className="text-purple-900 dark:text-purple-100">Sobre o Sistema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-purple-800 dark:text-purple-200">
          <p>
            <span className="font-semibold">Controle Financeiro Pessoal</span> é um sistema elegante e sofisticado
            para gerenciar suas finanças pessoais.
          </p>
          <p>
            Com funcionalidades completas como transações, categorias, orçamentos, metas e relatórios, você tem
            tudo o que precisa para manter suas finanças sob controle.
          </p>
          <p className="pt-2 border-t border-purple-200 dark:border-purple-700">
            Versão 1.0.0 • Todos os direitos reservados
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
