import * as Contacts from "expo-contacts";
import * as Crypto from "expo-crypto";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { Platform } from "react-native";

/**
 * Lê a agenda, normaliza cada número pra E.164 e devolve os hashes SHA-256
 * (hex, lowercase). NUNCA retorna números em claro. `defaultCountry` resolve
 * números locais sem código de país (BR por padrão).
 */
export async function collectContactHashes(defaultCountry = "BR"): Promise<string[]> {
  // Web não tem Contact Picker API confiável cross-browser — a UI já oculta
  // essa feature inteira em Platform.OS === "web" (ver app/(app)/friends.tsx),
  // isto é só uma proteção extra caso algum outro caller apareça.
  if (Platform.OS === "web") {
    throw new Error("contacts_not_supported_web");
  }

  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== "granted") {
    throw new Error("contacts_permission_denied");
  }

  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers],
  });

  const e164Set = new Set<string>();
  for (const contact of data) {
    for (const phone of contact.phoneNumbers ?? []) {
      if (!phone.number) continue;
      const parsed = parsePhoneNumberFromString(phone.number, defaultCountry as never);
      if (parsed?.isValid()) {
        e164Set.add(parsed.number); // E.164 com '+'
      }
    }
  }

  const hashes = await Promise.all(
    [...e164Set].map((e164) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, e164)),
  );
  // expo-crypto retorna hex lowercase — mesmo formato do backend (node crypto).
  return hashes;
}
