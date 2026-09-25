"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Order = {
  id: number;
  created_at: string;
  customer_name: string | null;
  order_type: string;
  items: string;
  total: number;
  status: string;
  notes: string | null;
};

type OrderItem = {
  product: string;
  quantity: number;
  unit_price?: number;
  line_total?: number;
  accompaniment?: string;
  sauce?: string;
  notes?: string;
};

type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  available: boolean;
};

type Tab = "orders" | "products";
type OrderView = "active" | "history";

const statusOptions = [
  {
    value: "confirmed",
    label: "Confirmée",
  },
  {
    value: "preparing",
    label: "En préparation",
  },
  {
    value: "ready",
    label: "Prête",
  },
  {
    value: "completed",
    label: "Terminée",
  },
  {
    value: "cancelled",
    label: "Annulée",
  },
];

function getStatusLabel(status: string) {
  const found = statusOptions.find(
    (option) => option.value === status
  );

  return found?.label || status;
}

function getStatusClass(status: string) {
  if (status === "confirmed") {
    return "bg-blue-100 text-blue-700";
  }

  if (status === "preparing") {
    return "bg-orange-100 text-orange-700";
  }

  if (status === "ready") {
    return "bg-green-100 text-green-700";
  }

  if (status === "completed") {
    return "bg-gray-200 text-gray-700";
  }

  if (status === "cancelled") {
    return "bg-red-100 text-red-700";
  }

  return "bg-gray-100 text-gray-700";
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [tab, setTab] = useState<Tab>("orders");
  const [orderView, setOrderView] =
    useState<OrderView>("active");

  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [ordersError, setOrdersError] = useState("");
  const [productsError, setProductsError] = useState("");

  const [lastRefresh, setLastRefresh] =
    useState<Date | null>(null);

  const [updatingProductId, setUpdatingProductId] =
    useState<number | null>(null);

  const [updatingOrderId, setUpdatingOrderId] =
    useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState("Toutes");

  async function getAccessToken() {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();

    return currentSession?.access_token || null;
  }

  async function loadOrders() {
    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        return;
      }

      const response = await fetch(
        `/api/orders?t=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Erreur lors du chargement des commandes"
        );
      }

      setOrders(result.orders || []);
      setOrdersError("");
      setLastRefresh(new Date());
    } catch (err) {
      setOrdersError(
        err instanceof Error
          ? err.message
          : "Erreur inconnue"
      );
    } finally {
      setLoadingOrders(false);
    }
  }

  async function loadProducts() {
    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        return;
      }

      const response = await fetch(
        `/api/products?t=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Erreur lors du chargement des produits"
        );
      }

      setProducts(result.products || []);
      setProductsError("");
    } catch (err) {
      setProductsError(
        err instanceof Error
          ? err.message
          : "Erreur inconnue"
      );
    } finally {
      setLoadingProducts(false);
    }
  }

  async function toggleProductAvailability(
    product: Product
  ) {
    try {
      setUpdatingProductId(product.id);

      const accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error("Session expirée");
      }

      const response = await fetch("/api/products", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          id: product.id,
          available: !product.available,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Impossible de modifier le produit"
        );
      }

      setProducts((currentProducts) =>
        currentProducts.map((currentProduct) =>
          currentProduct.id === product.id
            ? result.product
            : currentProduct
        )
      );

      setProductsError("");
    } catch (err) {
      setProductsError(
        err instanceof Error
          ? err.message
          : "Erreur inconnue"
      );
    } finally {
      setUpdatingProductId(null);
    }
  }

  async function updateOrderStatus(
    orderId: number,
    newStatus: string
  ) {
    try {
      setUpdatingOrderId(orderId);

      const accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error("Session expirée");
      }

      const response = await fetch(
        "/api/orders/status",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            id: orderId,
            status: newStatus,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Impossible de modifier le statut"
        );
      }

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status: result.order.status,
              }
            : order
        )
      );

      setOrdersError("");
    } catch (err) {
      setOrdersError(
        err instanceof Error
          ? err.message
          : "Erreur inconnue"
      );
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function handleLogin(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    try {
      setLoginLoading(true);
      setLoginError("");

      const { error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (error) {
        throw error;
      }

      setPassword("");
    } catch (err) {
      setLoginError(
        err instanceof Error
          ? err.message
          : "Connexion impossible"
      );
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();

    setOrders([]);
    setProducts([]);
    setLastRefresh(null);
  }

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      setSession(currentSession);
      setAuthLoading(false);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession);
        setAuthLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    setLoadingOrders(true);
    setLoadingProducts(true);

    loadOrders();
    loadProducts();

    const interval = setInterval(() => {
      loadOrders();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [session]);

  const activeOrders = useMemo(() => {
    return orders.filter((order) =>
      ["confirmed", "preparing", "ready"].includes(
        order.status
      )
    );
  }, [orders]);

  const historyOrders = useMemo(() => {
    return orders.filter((order) =>
      ["completed", "cancelled"].includes(
        order.status
      )
    );
  }, [orders]);

  const preparingCount = useMemo(() => {
    return orders.filter(
      (order) => order.status === "preparing"
    ).length;
  }, [orders]);

  const readyCount = useMemo(() => {
    return orders.filter(
      (order) => order.status === "ready"
    ).length;
  }, [orders]);

  const displayedOrders =
    orderView === "active"
      ? activeOrders
      : historyOrders;

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(
        products.map(
          (product) => product.category
        )
      )
    );

    return ["Toutes", ...uniqueCategories];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.name
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesCategory =
        selectedCategory === "Toutes" ||
        product.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
        <div className="rounded-xl bg-white p-8 shadow">
          Chargement...
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold">
              Frenchy Test
            </h1>

            <p className="mt-2 text-gray-500">
              Connexion au tableau de bord
            </p>
          </div>

          <form
            onSubmit={handleLogin}
            className="space-y-5"
          >
            <div>
              <label className="mb-2 block text-sm font-medium">
                Adresse email
              </label>

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                required
                autoComplete="email"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                placeholder="restaurant@email.com"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Mot de passe
              </label>

              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                placeholder="Votre mot de passe"
              />
            </div>

            {loginError && (
              <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full rounded-xl bg-black px-4 py-3 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loginLoading
                ? "Connexion..."
                : "Se connecter"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              Frenchy Test
            </h1>

            <p className="mt-2 text-gray-600">
              Tableau de bord restaurant
            </p>

            <p className="mt-1 text-xs text-gray-400">
              {session.user.email}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Se déconnecter
          </button>
        </div>

        <div className="mb-6 flex gap-2 rounded-xl bg-white p-2 shadow-sm">
          <button
            onClick={() => setTab("orders")}
            className={`rounded-lg px-5 py-3 font-medium transition ${
              tab === "orders"
                ? "bg-black text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Commandes
          </button>

          <button
            onClick={() => setTab("products")}
            className={`rounded-lg px-5 py-3 font-medium transition ${
              tab === "products"
                ? "bg-black text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Produits
          </button>
        </div>

        {tab === "orders" && (
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold">
                Commandes
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Les nouvelles commandes apparaissent automatiquement.
              </p>
            </div>

            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">
                  Commandes actives
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {activeOrders.length}
                </p>
              </div>

              <div className="rounded-xl bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">
                  En préparation
                </p>

                <p className="mt-2 text-3xl font-bold text-orange-600">
                  {preparingCount}
                </p>
              </div>

              <div className="rounded-xl bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">
                  Prêtes
                </p>

                <p className="mt-2 text-3xl font-bold text-green-600">
                  {readyCount}
                </p>
              </div>
            </div>

            <div className="mb-6 flex items-center justify-between gap-4">
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setOrderView("active")
                  }
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                    orderView === "active"
                      ? "bg-black text-white"
                      : "bg-white text-gray-600"
                  }`}
                >
                  Actives ({activeOrders.length})
                </button>

                <button
                  onClick={() =>
                    setOrderView("history")
                  }
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                    orderView === "history"
                      ? "bg-black text-white"
                      : "bg-white text-gray-600"
                  }`}
                >
                  Historique ({historyOrders.length})
                </button>
              </div>

              {lastRefresh && (
                <p className="text-xs text-gray-400">
                  Actualisé à{" "}
                  {lastRefresh.toLocaleTimeString(
                    "fr-FR"
                  )}
                </p>
              )}
            </div>

            {ordersError && (
              <div className="mb-6 rounded-xl bg-red-50 p-4 text-red-700">
                Erreur : {ordersError}
              </div>
            )}

            {loadingOrders ? (
              <div className="rounded-xl bg-white p-6 shadow">
                Chargement...
              </div>
            ) : displayedOrders.length === 0 ? (
              <div className="rounded-xl bg-white p-8 text-center shadow">
                <p className="text-gray-500">
                  {orderView === "active"
                    ? "Aucune commande active."
                    : "Aucune commande dans l'historique."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {displayedOrders.map((order) => {
                  let items: OrderItem[] = [];

                  try {
                    items =
                      typeof order.items === "string"
                        ? JSON.parse(order.items)
                        : order.items;
                  } catch {
                    items = [];
                  }

                  return (
                    <div
                      key={order.id}
                      className="rounded-xl bg-white p-6 shadow"
                    >
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-xl font-bold">
                            FT-
                            {String(order.id).padStart(
                              4,
                              "0"
                            )}
                          </h3>

                          <p className="mt-1 text-gray-600">
                            {order.customer_name ||
                              "Sans nom"}
                          </p>

                          <p className="mt-1 text-sm text-gray-500">
                            {order.order_type ===
                            "dine_in"
                              ? "Sur place"
                              : "À emporter"}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-2xl font-bold">
                            {Number(
                              order.total
                            ).toFixed(2)}{" "}
                            €
                          </p>

                          <p className="mt-1 text-sm text-gray-500">
                            {new Date(
                              order.created_at
                            ).toLocaleString(
                              "fr-FR"
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3 border-t pt-4">
                        {items.map(
                          (item, index) => (
                            <div
                              key={index}
                              className="rounded-lg bg-gray-50 p-3"
                            >
                              <p className="font-semibold">
                                {item.quantity} ×{" "}
                                {item.product}
                              </p>

                              {item.sauce && (
                                <p className="mt-1 text-sm text-gray-600">
                                  Sauce :{" "}
                                  {item.sauce}
                                </p>
                              )}

                              {item.accompaniment && (
                                <p className="mt-1 text-sm text-gray-600">
                                  Accompagnement :{" "}
                                  {
                                    item.accompaniment
                                  }
                                </p>
                              )}

                              {item.notes && (
                                <p className="mt-1 text-sm text-gray-600">
                                  Note :{" "}
                                  {item.notes}
                                </p>
                              )}
                            </div>
                          )
                        )}
                      </div>

                      {order.notes && (
                        <div className="mt-4 rounded-lg bg-yellow-50 p-3">
                          <p className="text-sm">
                            Note commande :{" "}
                            {order.notes}
                          </p>
                        </div>
                      )}

                      <div className="mt-5 border-t pt-4">
                        <div className="mb-4 flex items-center justify-between gap-4">
                          <span
                            className={`rounded-full px-3 py-1 text-sm font-semibold ${getStatusClass(
                              order.status
                            )}`}
                          >
                            {getStatusLabel(
                              order.status
                            )}
                          </span>

                          {updatingOrderId ===
                            order.id && (
                            <span className="text-sm text-gray-400">
                              Mise à jour...
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {statusOptions.map(
                            (status) => (
                              <button
                                key={
                                  status.value
                                }
                                onClick={() =>
                                  updateOrderStatus(
                                    order.id,
                                    status.value
                                  )
                                }
                                disabled={
                                  updatingOrderId ===
                                    order.id ||
                                  order.status ===
                                    status.value
                                }
                                className={`rounded-lg border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${
                                  order.status ===
                                  status.value
                                    ? "border-black bg-black text-white"
                                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                                }`}
                              >
                                {
                                  status.label
                                }
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {tab === "products" && (
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold">
                Produits
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Gérez la disponibilité des produits du restaurant.
              </p>
            </div>

            {productsError && (
              <div className="mb-6 rounded-xl bg-red-50 p-4 text-red-700">
                Erreur : {productsError}
              </div>
            )}

            <div className="mb-6 grid gap-3 md:grid-cols-2">
              <input
                type="text"
                placeholder="Rechercher un produit..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                className="rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
              />

              <select
                value={selectedCategory}
                onChange={(event) =>
                  setSelectedCategory(
                    event.target.value
                  )
                }
                className="rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
              >
                {categories.map(
                  (category) => (
                    <option
                      key={category}
                      value={category}
                    >
                      {category}
                    </option>
                  )
                )}
              </select>
            </div>

            {loadingProducts ? (
              <div className="rounded-xl bg-white p-6 shadow">
                Chargement...
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl bg-white shadow">
                <div className="hidden grid-cols-[1fr_180px_120px_180px] gap-4 border-b bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-600 md:grid">
                  <div>Produit</div>
                  <div>Catégorie</div>
                  <div>Prix</div>
                  <div>Disponibilité</div>
                </div>

                {filteredProducts.map(
                  (product) => (
                    <div
                      key={product.id}
                      className="grid gap-3 border-b px-5 py-4 last:border-b-0 md:grid-cols-[1fr_180px_120px_180px] md:items-center"
                    >
                      <div>
                        <p className="font-semibold">
                          {product.name}
                        </p>

                        <p className="mt-1 text-sm text-gray-500 md:hidden">
                          {product.category}
                        </p>
                      </div>

                      <div className="hidden text-sm text-gray-600 md:block">
                        {product.category}
                      </div>

                      <div className="font-medium">
                        {Number(
                          product.price
                        ).toFixed(2)}{" "}
                        €
                      </div>

                      <button
                        onClick={() =>
                          toggleProductAvailability(
                            product
                          )
                        }
                        disabled={
                          updatingProductId ===
                          product.id
                        }
                        className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          product.available
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-red-100 text-red-700 hover:bg-red-200"
                        }`}
                      >
                        {updatingProductId ===
                        product.id
                          ? "Mise à jour..."
                          : product.available
                          ? "Disponible"
                          : "Indisponible"}
                      </button>
                    </div>
                  )
                )}

                {filteredProducts.length === 0 && (
                  <div className="p-6 text-center text-gray-500">
                    Aucun produit trouvé.
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}