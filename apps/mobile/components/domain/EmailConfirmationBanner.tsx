import { AlertTriangle } from "lucide-react-native";
import { Text, View } from "react-native";
import { colors } from "@/lib/colors";
import { useAuthSession } from "@/lib/hooks/useAuthSession";

/**
 * Conta que virou "real" (e-mail/senha aplicados via updateUser numa sessão
 * anônima) continua funcionando normalmente nesta sessão mesmo sem o e-mail
 * confirmado — só não consegue logar de outro dispositivo. Se a pessoa
 * reinstalar o app ou trocar de aparelho antes de confirmar, perde o acesso
 * à conta pra sempre. Esse banner é o único aviso visível disso (o e-mail de
 * confirmação em si é fácil de perder/ignorar).
 */
export function EmailConfirmationBanner() {
  const authSession = useAuthSession();
  if (authSession.status !== "signed_in") return null;

  const { user } = authSession.session;
  const pendingEmail = user.is_anonymous ? user.new_email : undefined;
  if (!pendingEmail) return null;

  return (
    <View className="flex-row items-start gap-3 rounded-2xl border border-warning-400 bg-warning-50 p-4">
      <AlertTriangle size={20} color={colors.warning[500]} />
      <View className="flex-1 gap-1">
        <Text className="font-sans-semibold text-sm text-neutral-800">Confirme seu e-mail</Text>
        <Text className="font-sans text-sm text-neutral-600">
          Enviamos um link de confirmação para {pendingEmail}. Confirme para não perder o acesso à
          sua conta se trocar de aparelho ou reinstalar o app.
        </Text>
      </View>
    </View>
  );
}
