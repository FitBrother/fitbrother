import { Text, View } from "react-native";
import type { Comment } from "@fitbrother/shared";
import { Avatar } from "@/components/Avatar";
import { profileInitials } from "@/lib/account-utils";
import { relativeTime } from "@/lib/social/post-format";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

/**
 * Um comentário: foto, balão com autor e texto, horário embaixo.
 *
 * Antes era uma linha corrida com `@username` em negrito, o texto embaixo e um
 * filete separando — a mesma forma de um item de lista de configurações, sem
 * nada dizendo que ali é gente conversando. O balão recuado ao lado da foto é a
 * forma que todo mundo já lê como conversa, e casa com a barra de escrever
 * logo abaixo, que agora é um composer.
 *
 * O nome vai DENTRO do balão e o horário fora: dentro, o horário disputaria
 * com o texto do comentário; fora, ele vira metadado da linha, que é o que é.
 */
export function CommentRow({ comment }: { comment: Comment }) {
  const nome = comment.author.display_name?.trim() || "Fitbrother";
  const username = comment.author.username ? `@${comment.author.username}` : null;

  return (
    <View className="flex-row gap-3 px-4 py-2">
      <Avatar
        uri={comment.author.avatar_url}
        initials={profileInitials(comment.author.display_name, comment.author.username)}
        size={36}
        accessibilityLabel={`Foto de ${nome}`}
      />
      {/* `items-start` para o balão encolher até o conteúdo em vez de esticar
          na largura toda — um comentário de uma palavra num balão de linha
          inteira não lê como fala. */}
      <View className="flex-1 items-start">
        <View className="max-w-full rounded-2xl rounded-tl-md bg-neutral-100 px-3.5 py-2.5">
          <View className="flex-row items-baseline gap-1.5">
            <Text className="font-sans-semibold text-sm text-neutral-800">{nome}</Text>
            {username ? (
              <Text className="font-sans text-xs text-neutral-500" numberOfLines={1}>
                {username}
              </Text>
            ) : null}
          </View>
          <Text className="mt-0.5 text-base font-sans text-neutral-700">{comment.body}</Text>
        </View>
        <Text style={NUM} className="ml-3.5 mt-1 font-sans text-xs text-neutral-400">
          {relativeTime(comment.created_at)}
        </Text>
      </View>
    </View>
  );
}
