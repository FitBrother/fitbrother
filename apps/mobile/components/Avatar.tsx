import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { SkeletonCircle } from "@/components/Skeleton";

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
  loading = false,
}: {
  uri?: string | null;
  initials: string;
  size?: number;
  accessibilityLabel?: string;
  /**
   * Ainda não se sabe se há foto (ex.: URL assinada não voltou, upload em
   * andamento) — mostra skeleton em vez de cair nas iniciais. `uri` some
   * (`null`/`undefined`) só quer dizer "sem foto" quando `loading` é falso;
   * antes dessa distinção, o avatar mostrava as iniciais por um instante no
   * primeiro carregamento, mesmo quando o usuário tinha foto cadastrada.
   */
  loading?: boolean;
}) {
  // Tamanho vai em `style` porque é dinâmico: o Tailwind gera classes
  // estáticas e não daria conta de um diâmetro vindo por prop.
  const box = { width: size, height: size, borderRadius: size / 2 };

  // A foto em si (não a query que trouxe a URL) pode levar um tempo pra
  // baixar — sem isso, o círculo ficava transparente até o download
  // terminar, e a imagem "estourava" na tela do nada.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => setLoaded(false), [uri]);

  // Fundo verde (`bg-primary-100`) é o encosto das iniciais, não uma cor de
  // base do componente — em qualquer estado de loading (com ou sem `uri`
  // ainda resolvida) o fundo fica neutro, pro skeleton por cima nunca
  // aparecer sobre um verde.
  const showingInitials = !loading && !uri;

  return (
    <View
      testID="avatar"
      style={box}
      className={`items-center justify-center overflow-hidden rounded-full ${
        showingInitials ? "bg-primary-100" : "bg-neutral-100"
      }`}
    >
      {loading ? (
        <SkeletonCircle size={size} />
      ) : uri ? (
        <>
          <Image
            testID="avatar-image"
            source={{ uri }}
            style={box}
            accessibilityLabel={accessibilityLabel}
            onLoad={() => setLoaded(true)}
          />
          {!loaded && (
            <SkeletonCircle size={size} style={{ position: "absolute", top: 0, left: 0 }} />
          )}
        </>
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
