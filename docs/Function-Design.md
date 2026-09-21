# The Bake Alley Function Design

## Purpose

The Bake Alley is a responsive single-page storefront for browsing baking ingredients, decorations, tools, and packaging. The page is designed to help home bakers and small pastry businesses quickly find products and contact the store for larger or custom orders.

## Page Structure

- **Announcement bar:** Communicates the store promise and local pickup availability.
- **Header:** Uses the Bake Alley logo, brand name, primary navigation, and an inventory call to action.
- **Hero:** Introduces the store with the primary message, supporting copy, and a link to the inventory.
- **Story strip:** Communicates the calming, communal role of baking.
- **Inventory:** Provides category tabs, live search, an available-only toggle, product cards, and stock states.
- **Testimonials:** Shows social proof from local bakers and pastry businesses.
- **Order and inquire:** Links customers to Messenger, WhatsApp, and Viber for bulk or custom requests.
- **Footer:** Displays hours, address, social links, and the closing brand message.

## Inventory Behavior

Product data is represented by objects with these fields:

- `name`: Product display name.
- `category`: One of the inventory categories.
- `size`: Unit or package size.
- `price`: Numeric price rendered in Philippine pesos.
- `image`: Product image URL.
- `stock`: `Available`, `Running Low`, or `Out of Stock`.

The client initially renders the built-in mock inventory so the page works in preview mode. If `window.BAKE_ALLEY_SUPABASE_URL` and `window.BAKE_ALLEY_SUPABASE_ANON_KEY` are configured, the Supabase client queries the `products` table and replaces the mock data when rows are returned. A failed or empty query leaves the mock inventory in place.

Filtering is applied in the browser whenever the selected category, search input, or availability toggle changes. Search matches the product name and category. The out-of-stock products are excluded when **Available only** is enabled. The result count and empty state update with every filter operation.

## External Integrations

- `@supabase/supabase-js` is loaded from the browser CDN for optional inventory loading.
- Product and hero imagery uses remote image URLs with styled backgrounds as visual fallbacks.
- Contact links point to Messenger, WhatsApp, and Viber.

## Responsive Design

The layout uses CSS grid and mobile breakpoints. Desktop views show a two-column hero and four-column product grid. Narrow layouts collapse the hero, story, contact section, and testimonials into a single column, while the product grid remains a compact two-column catalog for efficient browsing.
