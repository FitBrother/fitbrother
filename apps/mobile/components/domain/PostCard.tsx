import type { Post } from "@fitbrother/shared";
import { useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { MessageCircle, Share2, Trophy } from "lucide-react-native";
import { useRouter } from "expo-router";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import { profileInitials } from "@/lib/account-utils";
import { getPostImageSignedUrl } from "@/lib/storage";
import { relativeTime } from "@/lib/social/post-format";
import { Avatar } from "@/components/Avatar";
import { SkeletonBlock } from "@/components/Skeleton";
import { MacroSplitBar } from "./MacroSplitBar";
import { LikeButton } from "./LikeButton";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

export function PostCard({ post }: { post: Post }) {
  const router = useRouter();
  const name = post.author.display_name ?? "Fitbrother";
  const username = post.author.username ? `@${post.author.username}` : "";
  const achievement = post.post_type === "achievement" ? post.achievement : null;
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  // Distingue "ainda buscando a URL assinada" de "buscou e não há foto" —
  // sem isso, uma falha na assinatura deixava a área da imagem vazia mas sem
  // fechar o skeleton, que ficava girando pra sempre.
  const [imageChecked, setImageChecked] = useState(false);
  // A URL assinada resolver não significa que os pixels já chegaram — o
  // download em si pode demorar, e sem isso a foto "estourava" na tela do
  // nada assim que terminava.
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    setImageChecked(false);
    setImageLoaded(false);
    setImageUrl(null);
    if (post.image_path) {
      getPostImageSignedUrl(post.image_path)
        .then((url) => {
          if (!active) return;
          setImageUrl(url);
          setImageChecked(true);
        })
        .catch(() => {
          if (active) setImageChecked(true);
        });
    } else {
      setImageChecked(true);
    }
    return () => {
      active = false;
    };
  }, [post.image_path]);

  // Reserva a área da foto enquanto ainda não sabemos se ela existe (evita o
  // "pulo" de layout quando a URL assinada chega) ou enquanto já sabemos que
  // existe uma. Sem foto de fato (checado e sem URL), não reserva nada — igual
  // ao comportamento de antes.
  const hasImageArea = Boolean(post.image_path) && (!imageChecked || Boolean(imageUrl));

  function abrirPost() {
    router.push(`/(app)/post/${post.id}` as never);
  }

  return (
    <View style={shadows.card} className="rounded-[26px] bg-white p-4">
      {/* Cabeçalho leva ao perfil de quem postou. Um feed onde não dá pra tocar
          no nome de alguém é um mural, não uma rede — e descobrir gente pelos
          posts é o caminho mais natural para seguir alguém novo. */}
      <Pressable
        onPress={() => router.push(`/(app)/users/${post.author.user_id}` as never)}
        accessibilityRole="button"
        accessibilityLabel={`Ver perfil de ${name}`}
        className="min-h-[44px] flex-row items-center active:opacity-70"
      >
        {/* O avatar de verdade estava sendo ignorado: `author.avatar_url` vem
            assinado do servidor e o card desenhava só a inicial. Rosto é o que
            faz um feed parecer gente; a inicial é o fallback, não o padrão. */}
        <Avatar
          uri={post.author.avatar_url}
          initials={profileInitials(post.author.display_name, post.author.username)}
          size={44}
          accessibilityLabel={`Foto de ${name}`}
        />
        <View className="ml-3 flex-1">
          <Text className="font-sans-semibold text-neutral-800" numberOfLines={1}>
            {name}
          </Text>
          {/* Sem username não renderiza a linha: um Text vazio ainda ocupa a
              altura dela e desalinha o nome em relação ao avatar. */}
          {username ? (
            <Text className="font-sans text-xs text-neutral-500" numberOfLines={1}>
              {username}
            </Text>
          ) : null}
        </View>
        {/* Horário fora da linha do username: empilhado com ele, o "· 2h" virava
            sufixo do nome e sumia. Na direita é o canto onde todo feed põe
            tempo, e some do caminho da leitura do nome. */}
        <Text style={NUM} className="ml-2 font-sans text-xs text-neutral-400">
          {relativeTime(post.created_at)}
        </Text>
      </Pressable>

      {post.caption ? (
        <Text className="mt-3 text-base font-sans text-neutral-800">{post.caption}</Text>
      ) : null}

      {hasImageArea ? (
        <View className="relative mt-3 h-64 w-full overflow-hidden rounded-2xl">
          {imageUrl && (
            <Image
              source={{ uri: imageUrl }}
              accessibilityIgnoresInvertColors
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
              onLoad={() => setImageLoaded(true)}
            />
          )}
          {(!imageChecked || !imageLoaded) && (
            <SkeletonBlock
              width="100%"
              height={256}
              radius={16}
              style={{ position: "absolute", top: 0, left: 0 }}
            />
          )}
        </View>
      ) : null}

      {achievement ? (
        /* Conquista em menta, não em `warning-*`. Os tokens de alerta vestiam
           uma comemoração de aviso — âmbar sobre borda âmbar é o que o app usa
           para "atenção", e ver isso ao bater 7 dias de ofensiva inverte a
           mensagem. Menta é a cor de marca e de progresso no resto do app. */
        <View className="mt-4 flex-row items-center gap-3 rounded-2xl bg-primary-50 p-4">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-100">
            <Trophy size={20} color={colors.primary[700]} />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-sans-semibold uppercase text-primary-700">Conquista</Text>
            <Text className="mt-0.5 text-lg font-display-bold text-neutral-800">
              {achievement.title}
            </Text>
            <Text className="mt-0.5 text-sm font-sans text-neutral-600">
              {achievement.description}
            </Text>
          </View>
        </View>
      ) : (
        <View className="mt-4">
          {/* `text-base`, não `text-2xl`: no feed a caloria é contexto, não
              manchete. Em 24px ela competia com a legenda escrita pela pessoa
              e virava a primeira coisa lida em todo card — leitura errada num
              feed social, onde o assunto é a refeição, não o número. O número
              hero continua sendo o do resumo do dia, na Home. */}
          <View className="flex-row items-baseline gap-1">
            <Text style={NUM} className="text-base font-display-bold text-neutral-700">
              {Math.round(post.total_kcal)}
            </Text>
            <Text className="font-sans text-sm text-neutral-500">kcal</Text>
          </View>
          {/* Sem a caixa cinza em volta: um card branco com um bloco cinza
              dentro lia como recibo. A barra já delimita o dado sozinha. */}
          <View className="mt-3">
            <MacroSplitBar
              protein={post.total_protein_g}
              carbs={post.total_carbs_g}
              fat={post.total_fat_g}
            />
          </View>
        </View>
      )}

      <View className="mt-4 flex-row items-center gap-1 border-t border-neutral-100 pt-1">
        <LikeButton postId={post.id} liked={post.liked_by_me} count={post.like_count} />
        <Pressable
          onPress={abrirPost}
          accessibilityRole="button"
          accessibilityLabel={
            post.comment_count > 0
              ? `Ver ${post.comment_count} comentário(s)`
              : "Comentar nesta publicação"
          }
          className="min-h-[44px] min-w-[44px] flex-row items-center gap-1.5 px-2 active:opacity-70"
        >
          <MessageCircle size={20} color={colors.neutral[500]} />
          {/* Zero não vira "0": um contador zerado só confirma que ninguém
              respondeu. Trocado pelo convite a ser o primeiro. */}
          {post.comment_count > 0 ? (
            <Text style={NUM} className="font-sans-medium text-neutral-600">
              {post.comment_count}
            </Text>
          ) : (
            <Text className="font-sans text-sm text-neutral-500">Comentar</Text>
          )}
        </Pressable>
        {/* `Share2` é o ícone que, num feed, promete a folha de
            compartilhamento do sistema — e é exatamente o que este caminho
            entrega (via a tela de preview). O rótulo diz "fora do Fitbrother"
            porque dentro do app "compartilhar" já significa publicar no feed,
            que é o que esta publicação já é. */}
        <Pressable
          onPress={() => router.push(`/(app)/share/post/${post.id}` as never)}
          accessibilityRole="button"
          accessibilityLabel="Compartilhar fora do Fitbrother"
          className="ml-auto min-h-[44px] min-w-[44px] items-center justify-center active:opacity-70"
        >
          <Share2 size={20} color={colors.neutral[500]} />
        </Pressable>
      </View>
    </View>
  );
}
