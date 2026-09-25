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
    error: restaurantError,
  } = await supabase
    .from("restaurant_users")
    .select("restaurant")
    .eq("user_id", user.id)
    .single();

  if (
    restaurantError ||
    !restaurantUser?.restaurant
  ) {
    throw new Error(
      "Aucun restaurant associé à ce compte"
    );
  }

  return {
    supabase,
    restaurant: restaurantUser.restaurant,
  };
}

export async function GET(req: NextRequest) {
  try {
    const {
      supabase,
      restaurant,
    } = await getAuthenticatedRestaurant(req);

    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        name,
        category,
        price,
        available
      `)
      .eq("restaurant", restaurant)
      .order("category", { ascending: true })
      .order("name", { ascending: true });

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
        products: data || [],
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
      }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const {
      supabase,
      restaurant,
    } = await getAuthenticatedRestaurant(req);

    const body = await req.json();

    const productId = Number(body.id);
    const available = body.available;

    if (!Number.isInteger(productId)) {
      return NextResponse.json(
        {
          success: false,
          error: "id produit invalide",
        },
        { status: 400 }
      );
    }

    if (typeof available !== "boolean") {
      return NextResponse.json(
        {
          success: false,
          error: "available doit être true ou false",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("products")
      .update({
        available,
      })
      .eq("id", productId)
      .eq("restaurant", restaurant)
      .select(`
        id,
        name,
        category,
        price,
        available
      `)
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
      product: data,
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