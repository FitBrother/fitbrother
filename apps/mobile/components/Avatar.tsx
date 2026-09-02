import { Image, Text, View } from "react-native";

/**
 * Proporção entre o diâmetro do avatar e o tamanho das iniciais do fallback.
 * Mantém as iniciais legíveis e centradas em qualquer tamanho sem precisar de
 * uma classe de tipografia por medida.
 *
 * 0.32, não 0.38: o fallback é um substituto da foto, não um elemento por
 * conta própria. Em 0.38 as iniciais no header saíam com 20px em peso bold —
 * maior que o número da ofensiva (18) na mesma linha, o que dava ao canto do
 * perfil um peso que ele não deve ter.
 */
const INITIALS_RATIO = 0.32;

/**
 * Foto de perfil circular com fallback para as iniciais.
 *
 * `uri` é uma URL pronta para carregar, não um caminho do Storage — o bucket
 * é privado, então quem assina é o servidor (perfis de terceiros) ou o hook
 * `useAvatarUrl` (perfil próprio).
 */
export function Avatar({
  uri,
  initials,
  size = 44,
  accessibilityLabel = "Foto de perfil",
}: {
  uri?: string | null;
  initials: string;
  size?: number;
  accessibilityLabel?: string;
}) {
  // Tamanho vai em `style` porque é dinâmico: o Tailwind gera classes
  // estáticas e não daria conta de um diâmetro vindo por prop.
  const box = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View
      testID="avatar"
      style={box}
      className="items-center justify-center overflow-hidden rounded-full bg-primary-100"
    >
      {uri ? (
        <Image
          testID="avatar-image"
          source={{ uri }}
          style={box}
          accessibilityLabel={accessibilityLabel}
        />
      ) : (
        <Text
          testID="avatar-initials"
          style={{ fontSize: Math.round(size * INITIALS_RATIO) }}
          className="font-sans-bold text-primary-800"
        >
          {initials}
        </Text>
      )}
    </View>
  );
}
