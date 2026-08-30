import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";

// Os painéis fazem fetch próprio; aqui só interessam os rótulos das sub-abas.
jest.mock("@/components/domain/FeedPostsPanel", () => ({ FeedPostsPanel: () => null }));
jest.mock("@/components/domain/FriendsPanel", () => ({ FriendsPanel: () => null }));

import { FeedTabContent } from "./FeedTabContent";

describe("sub-abas do Social", () => {
  test("a sub-aba de publicações é rotulada 'Feed'", () => {
    const { getByLabelText } = render(<FeedTabContent />);
    expect(getByLabelText("Feed")).toBeTruthy();
  });

  test("mantém a sub-aba Amigos", () => {
    const { getByLabelText } = render(<FeedTabContent />);
    expect(getByLabelText("Amigos")).toBeTruthy();
  });
});
