import Order from '../models/Order';
import MenuItem from '../models/menuItem';

export interface ShoppingListItem {
  name: string;
  total: number;
  unit: string;
  category: string;
}

export interface ShoppingListByCategory {
  [category: string]: ShoppingListItem[];
}

/** Extract a valid 24-char Mongo ObjectId from composite ids (e.g. `69ad...-size-0`). */
export function cleanProductObjectId(raw: unknown): string | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;

  const direct = value.match(/^[0-9a-fA-F]{24}$/);
  if (direct) return direct[0];

  const prefix = value.split('-')[0];
  if (/^[0-9a-fA-F]{24}$/.test(prefix)) return prefix;

  const embedded = value.match(/[0-9a-fA-F]{24}/);
  return embedded ? embedded[0] : null;
}

interface OrderLineItem {
  orderQuantity: number;
  itemName: string;
  productId: unknown;
}

export class ShoppingService {
  /**
   * Get shopping list based on active orders
   * Calculates total quantities of raw materials needed
   */
  async getShoppingList(safetyMargin: number = 0): Promise<ShoppingListByCategory> {
    try {
      const activeOrders = await Order.find({
        status: { $ne: 'cancelled' }
      }).lean();

      if (activeOrders.length === 0) {
        return {};
      }

      const lineItems: OrderLineItem[] = [];
      const uniqueCleanIds = new Set<string>();
      const uniqueNamesForLookup = new Set<string>();

      for (const order of activeOrders) {
        for (const item of order.items || []) {
          const orderQuantity = item.quantity || 1;
          const itemName = item.name || 'Unknown Item';
          const productId = item.productId || item.product;
          const cleanId = cleanProductObjectId(productId);

          lineItems.push({ orderQuantity, itemName, productId });

          if (cleanId) {
            uniqueCleanIds.add(cleanId);
          } else if (productId) {
            uniqueNamesForLookup.add(itemName);
          }
        }
      }

      const productMap = new Map<string, any>();
      if (uniqueCleanIds.size > 0) {
        const productsById = await MenuItem.find({
          _id: { $in: Array.from(uniqueCleanIds) }
        }).lean();
        for (const product of productsById) {
          productMap.set(String(product._id), product);
        }
      }

      const productByNameMap = new Map<string, any>();
      if (uniqueNamesForLookup.size > 0) {
        const productsByName = await MenuItem.find({
          name: { $in: Array.from(uniqueNamesForLookup) }
        }).lean();
        for (const product of productsByName) {
          const name = String(product.name || '');
          if (name && !productByNameMap.has(name)) {
            productByNameMap.set(name, product);
          }
        }
      }

      const ingredientMap: { [key: string]: ShoppingListItem } = {};

      const addFallbackIngredient = (name: string, orderQuantity: number) => {
        const key = `${name}_piece_General`;
        if (ingredientMap[key]) {
          ingredientMap[key].total += orderQuantity;
        } else {
          ingredientMap[key] = {
            name,
            total: orderQuantity,
            unit: 'piece',
            category: 'General'
          };
        }
      };

      const processProduct = (product: any, orderQuantity: number, itemName: string) => {
        const productName = String(product.name || itemName);
        const productRecipe = product.recipe;
        const hasRecipe =
          productRecipe && Array.isArray(productRecipe) && productRecipe.length > 0;

        const ingredientsToProcess: Array<{
          name?: string;
          quantity?: number;
          unit?: string;
          category?: string;
        }> = hasRecipe
          ? (productRecipe as Array<{
              name?: string;
              quantity?: number;
              unit?: string;
              category?: string;
            }>)
          : [
              {
                name: productName,
                quantity: 1,
                unit: 'יחידות',
                category: 'כללי / מוצרים ללא מתכון'
              }
            ];

        for (const ingredient of ingredientsToProcess) {
          if (!ingredient.name || !ingredient.unit || !ingredient.category) {
            continue;
          }

          const totalQuantity = orderQuantity * (ingredient.quantity || 1);
          const key = `${ingredient.name}_${ingredient.unit}_${ingredient.category}`;

          if (ingredientMap[key]) {
            ingredientMap[key].total += totalQuantity;
          } else {
            ingredientMap[key] = {
              name: ingredient.name,
              total: totalQuantity,
              unit: ingredient.unit,
              category: ingredient.category
            };
          }
        }
      };

      for (const { orderQuantity, itemName, productId } of lineItems) {
        if (!productId) {
          addFallbackIngredient(itemName, orderQuantity);
          continue;
        }

        const cleanId = cleanProductObjectId(productId);
        let product: any;

        if (cleanId) {
          product = productMap.get(cleanId);
        } else {
          product = productByNameMap.get(itemName);
        }

        if (!product) {
          addFallbackIngredient(itemName, orderQuantity);
          continue;
        }

        processProduct(product, orderQuantity, itemName);
      }

      if (safetyMargin > 0) {
        Object.keys(ingredientMap).forEach((key) => {
          ingredientMap[key].total = ingredientMap[key].total * (1 + safetyMargin / 100);
        });
      }

      const groupedByCategory: ShoppingListByCategory = {};

      Object.values(ingredientMap).forEach((item) => {
        if (!groupedByCategory[item.category]) {
          groupedByCategory[item.category] = [];
        }
        groupedByCategory[item.category].push(item);
      });

      Object.keys(groupedByCategory).forEach((category) => {
        groupedByCategory[category].sort((a, b) => a.name.localeCompare(b.name));
      });

      console.log(
        `🛒 Shopping list ready: ${Object.keys(groupedByCategory).length} categories, ${Object.keys(ingredientMap).length} ingredients`
      );

      return groupedByCategory;
    } catch (error: any) {
      console.error('❌ ShoppingService: Error generating shopping list:', error);
      throw new Error(`Failed to generate shopping list: ${error.message}`);
    }
  }
}
