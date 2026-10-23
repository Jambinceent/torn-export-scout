import { createServerFn } from "@tanstack/react-start";
import { scanBazaarItem, type BazaarPage } from "./bazaar-api.server";

export const fetchBazaarItem = createServerFn({ method: "POST" })
  .inputValidator((input: { itemId: number; page?: number }) => {
    if (!Number.isSafeInteger(input?.itemId) || input.itemId <= 0) throw new Error("Choose a valid item.");
    const page = input.page ?? 1;
    if (!Number.isSafeInteger(page) || page < 1 || page > 100) throw new Error("Choose a valid listings page.");
    return { itemId: input.itemId, page };
  })
  .handler(async ({ data }): Promise<{ data: BazaarPage | null; error: string | null }> => {
    try {
      return { data: await scanBazaarItem(data.itemId, data.page), error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : "Could not load bazaars. Try again later." };
    }
  });