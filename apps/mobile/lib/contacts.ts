import * as Contacts from "expo-contacts";
import * as Crypto from "expo-crypto";
import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Lê a agenda, normaliza cada número pra E.164 e devolve os hashes SHA-256
 * (hex, lowercase). NUNCA retorna números em claro. `defaultCountry` resolve
 * números locais sem código de país (BR por padrão).
 */
export async function collectContactHashes(defaultCountry = "BR"): Promise<string[]> {
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
