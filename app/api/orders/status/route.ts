import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
      active
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
    restaurant,
  };
}

const allowedStatuses = [
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
];

export async function PATCH(req: NextRequest) {
  try {
    const {
      supabase,
      restaurant,
    } = await getAuthenticatedRestaurant(req);

    const body = await req.json();

    const orderId = Number(body.id);
    const status = body.status;

    if (!Number.isInteger(orderId)) {
      return NextResponse.json(
        {
          success: false,
          error: "id commande invalide",
        },
        { status: 400 }
      );
    }

    if (
      typeof status !== "string" ||
      !allowedStatuses.includes(status)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Statut invalide",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("orders")
      .update({
        status,
      })
      .eq("id", orderId)
      .eq("restaurant_id", restaurant.id)
      .select("id, status")
      .single();

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      order: data,
    });
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
      }
    );
  }
}