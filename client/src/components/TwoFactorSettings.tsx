import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Loader2, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

/** Verificação em duas etapas (TOTP), opcional: ativar com QR code e desativar com senha + código. */
export default function TwoFactorSettings() {
  const utils = trpc.useUtils();
  const status = trpc.auth.twoFactor.status.useQuery();
  const setup = trpc.auth.twoFactor.setup.useMutation();
  const enable = trpc.auth.twoFactor.enable.useMutation();
  const disable = trpc.auth.twoFactor.disable.useMutation();
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [disabling, setDisabling] = useState(false);

  useEffect(() => {
    if (!setup.data) return setQr("");
    QRCode.toDataURL(setup.data.otpauthUrl, { margin: 1, width: 200 }).then(setQr, () => setQr(""));
  }, [setup.data]);

  async function confirm(e: FormEvent) {
    e.preventDefault();
    try {
      const r = await enable.mutateAsync({ code: code.trim() });
      setRecovery(r.recoveryCodes);
      setCode("");
      setup.reset();
      utils.auth.twoFactor.status.invalidate();
    } catch { /* a mensagem aparece pelo enable.error */ }
  }

  async function turnOff(e: FormEvent) {
    e.preventDefault();
    try {
      await disable.mutateAsync({ password, code: code.trim() });
      setDisabling(false);
      setPassword("");
      setCode("");
      utils.auth.twoFactor.status.invalidate();
      toast.success("Verificação em duas etapas desativada");
    } catch { /* idem */ }
  }

  if (status.isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;

  // códigos de recuperação: aparecem uma vez só, logo depois de ativar
  if (recovery) {
    return (
      <div className="space-y-3">
        <h4 className="font-medium">Códigos de recuperação</h4>
        <p className="text-sm text-muted-foreground">
          Guarde num lugar seguro. Cada código entra <strong>uma vez</strong> se você perder o celular. Eles não serão mostrados de novo.
        </p>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm">
          {recovery.map((c) => <li key={c}>{c}</li>)}
        </ul>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { navigator.clipboard?.writeText(recovery.join("\n")); toast.success("Copiado"); }}>Copiar</Button>
          <Button variant="ghost" onClick={() => setRecovery(null)}>Já guardei</Button>
        </div>
      </div>
    );
  }

  if (status.data?.enabled) {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 font-medium text-green-700 dark:text-green-400">
          <ShieldCheck className="h-4 w-4" /> Verificação em duas etapas ativa
        </p>
        {!disabling ? (
          <Button variant="outline" onClick={() => setDisabling(true)}>Desativar</Button>
        ) : (
          <form onSubmit={turnOff} className="max-w-xs space-y-3">
            <p className="text-sm text-muted-foreground">Para desativar, confirme a senha e um código do app (ou de recuperação).</p>
            <div className="space-y-1">
              <Label htmlFor="2fa-senha">Senha</Label>
              <Input id="2fa-senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="2fa-codigo">Código</Label>
              <Input id="2fa-codigo" value={code} onChange={(e) => setCode(e.target.value)} required autoComplete="one-time-code" />
            </div>
            {disable.error && <p role="alert" className="text-sm text-destructive">{disable.error.message}</p>}
            <div className="flex gap-2">
              <Button type="submit" variant="destructive" disabled={disable.isPending}>Desativar 2FA</Button>
              <Button type="button" variant="ghost" onClick={() => setDisabling(false)}>Cancelar</Button>
            </div>
          </form>
        )}
      </div>
    );
  }

  if (!setup.data) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Opcional: além da senha, o login passa a pedir um código do app autenticador (Google Authenticator, Authy, Microsoft Authenticator…).
        </p>
        <Button onClick={() => setup.mutate()} disabled={setup.isPending}>Ativar verificação em duas etapas</Button>
        {setup.error && <p role="alert" className="text-sm text-destructive">{setup.error.message}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={confirm} className="space-y-3">
      <p className="text-sm">1. Leia o QR code no app autenticador.</p>
      {qr && <img src={qr} width={200} height={200} alt="QR code para o app autenticador" className="rounded border" />}
      <p className="text-sm text-muted-foreground">
        Sem câmera? Digite a chave: <code className="break-all">{setup.data.secret.match(/.{1,4}/g)?.join(" ")}</code>
      </p>
      <div className="max-w-xs space-y-1">
        <Label htmlFor="2fa-confirmar">2. Digite o código de 6 dígitos que aparece no app</Label>
        <Input id="2fa-confirmar" value={code} onChange={(e) => setCode(e.target.value)} required inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" />
      </div>
      {enable.error && <p role="alert" className="text-sm text-destructive">{enable.error.message}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={enable.isPending}>Confirmar e ativar</Button>
        <Button type="button" variant="ghost" onClick={() => setup.reset()}>Cancelar</Button>
      </div>
    </form>
  );
}
