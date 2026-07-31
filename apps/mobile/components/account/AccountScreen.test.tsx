import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { AccountCard, AccountScreen } from "./AccountScreen";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
}));

describe("AccountScreen", () => {
  test("renders accessible account content and navigates back", () => {
    render(
      <AccountScreen title="Privacidade" subtitle="Gerencie seus dados">
        <AccountCard>
          <Text>Conteúdo</Text>
        </AccountCard>
      </AccountScreen>,
    );

    expect(screen.getByText("Privacidade")).toBeOnTheScreen();
    expect(screen.getByText("Gerencie seus dados")).toBeOnTheScreen();
    expect(screen.getByText("Conteúdo")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "Voltar" }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
