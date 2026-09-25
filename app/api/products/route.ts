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

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        name,
        category,
        price,
        available
      `)
      .eq("restaurant", "Frenchy Test")
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
            "Cache-Control": "no-store",
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
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
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

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("products")
      .update({
        available,
      })
      .eq("id", productId)
      .eq("restaurant", "Frenchy Test")
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
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}