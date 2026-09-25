import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("Variables Supabase manquantes");
  }

  return createClient(
    supabaseUrl,
    supabaseSecretKey
  );
}

async function getAuthenticatedRestaurant(
  req: NextRequest
) {
  const authorization =
    req.headers.get("authorization");

  if (
    !authorization ||
    !authorization.startsWith("Bearer ")
  ) {
    throw new Error("Non autorisé");
  }

  const accessToken = authorization.substring(7);

  const supabase = getSupabaseAdmin();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken);

  if (userError || !user) {
    throw new Error("Session invalide");
  }

  const {
    data: restaurantUser,
    error: restaurantUserError,
  } = await supabase
    .from("restaurant_users")
    .select("restaurant_id")
    .eq("user_id", user.id)
    .single();

  if (
    restaurantUserError ||
    !restaurantUser?.restaurant_id
  ) {
    throw new Error(
      "Aucun restaurant associé à ce compte"
    );
  }

  const {
    data: restaurant,
    error: restaurantError,
  } = await supabase
    .from("restaurants")
    .select(`
      id,
      name,
      slug,
      active,
      phone,
      address,
      default_wait_minutes,
      order_prefix
    `)
    .eq("id", restaurantUser.restaurant_id)
    .single();

  if (restaurantError || !restaurant) {
    throw new Error("Restaurant introuvable");
  }

  if (!restaurant.active) {
    throw new Error("Restaurant désactivé");
  }

  return {
    supabase,
    user,
    restaurant,
  };
}

export async function GET(req: NextRequest) {
  try {
    const {
      supabase,
      restaurant,
    } = await getAuthenticatedRestaurant(req);

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        {
          status: 500,
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,

        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          phone: restaurant.phone,
          address: restaurant.address,
          default_wait_minutes:
            restaurant.default_wait_minutes,
          order_prefix:
            restaurant.order_prefix,
        },

        orders: data || [],
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erreur inconnue";

    const unauthorized =
      message === "Non autorisé" ||
      message === "Session invalide";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      {
        status: unauthorized ? 401 : 403,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  }
}