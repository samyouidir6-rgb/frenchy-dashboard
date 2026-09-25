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

const allowedStatuses = [
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
];

export async function PATCH(req: NextRequest) {
  try {
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

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("orders")
      .update({
        status,
      })
      .eq("id", orderId)
      .eq("restaurant", "Frenchy Test")
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