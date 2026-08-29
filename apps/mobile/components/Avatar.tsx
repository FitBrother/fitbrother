import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { getPostImageSignedUrl } from "@/lib/storage";
import { profileInitials } from "@/lib/account-utils";

interface AvatarProps {
  avatarPath: string | null | undefined;
  fullName: string | null;
  email?: string | null;
  size?: number;
}

export function Avatar({ avatarPath, fullName, email = null, size = 36 }: AvatarProps) {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!avatarPath) {
      setUri(null);
      return;
    }
    void getPostImageSignedUrl(avatarPath)
      .then((url) => active && setUri(url))
      .catch(() => active && setUri(null));
    return () => {
      active = false;
    };
  }, [avatarPath]);

  const initials = profileInitials(fullName, email);

  return (
    <View
      style={{ height: size, width: size }}
      className="items-center justify-center overflow-hidden rounded-full bg-primary-100"
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ height: size, width: size }}
          accessibilityLabel="Foto do perfil"
        />
      ) : (
        <Text
          className="font-display-bold text-primary-800"
          style={{ fontSize: Math.round(size * 0.4) }}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}
