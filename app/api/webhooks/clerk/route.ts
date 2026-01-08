import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// =============================================================================
// CLERK WEBHOOK HANDLER
// Syncs user data from Clerk to our database
// =============================================================================

// Clerk webhook event types
interface ClerkUserEvent {
  type: "user.created" | "user.updated" | "user.deleted";
  data: {
    id: string; // user_xxx
    email_addresses?: Array<{ email_address: string; id: string }>;
    primary_email_address_id?: string;
    first_name?: string;
    last_name?: string;
  };
}

interface ClerkSessionEvent {
  type: "session.created" | "session.removed" | "session.ended";
  data: {
    id: string; // sess_xxx (session ID)
    user_id: string; // user_xxx (user ID)
  };
}

type ClerkWebhookEvent = ClerkUserEvent | ClerkSessionEvent;

export async function POST(request: NextRequest) {
  try {
    // Get the webhook secret
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error("[Clerk Webhook] Missing CLERK_WEBHOOK_SECRET");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    // Get the headers for verification
    const svix_id = request.headers.get("svix-id");
    const svix_timestamp = request.headers.get("svix-timestamp");
    const svix_signature = request.headers.get("svix-signature");

    if (!svix_id || !svix_timestamp || !svix_signature) {
      console.error("[Clerk Webhook] Missing svix headers");
      return NextResponse.json(
        { error: "Missing webhook headers" },
        { status: 400 }
      );
    }

    // Get the raw body
    const body = await request.text();

    // Verify the webhook signature
    const wh = new Webhook(webhookSecret);
    let payload: ClerkWebhookEvent;

    try {
      payload = wh.verify(body, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      }) as ClerkWebhookEvent;
    } catch (err) {
      console.error("[Clerk Webhook] Signature verification failed:", err);
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    const { type, data } = payload;
    console.log(`[Clerk Webhook] Verified event: ${type}`, JSON.stringify(data, null, 2));

    switch (type) {
      case "user.created":
      case "user.updated": {
        const userData = data as ClerkUserEvent["data"];
        
        // Get primary email
        const primaryEmail = userData.email_addresses?.find(
          (email) => email.id === userData.primary_email_address_id
        )?.email_address ?? userData.email_addresses?.[0]?.email_address;

        if (!primaryEmail) {
          console.error("[Clerk Webhook] No email for user:", userData.id);
          return NextResponse.json({ error: "No email provided" }, { status: 400 });
        }

        await db.user.upsert({
          where: { id: userData.id },
          create: {
            id: userData.id,
            email: primaryEmail,
            credits: 1000, // Welcome credits
          },
          update: {
            email: primaryEmail,
          },
        });

        console.log(`[Clerk Webhook] ✅ ${type === "user.created" ? "Created" : "Updated"} user: ${userData.id} (${primaryEmail})`);
        break;
      }

      case "user.deleted": {
        const userData = data as ClerkUserEvent["data"];
        console.log(`[Clerk Webhook] User deleted: ${userData.id}`);
        // Optionally delete user data: await db.user.delete({ where: { id: userData.id } });
        break;
      }

      case "session.created": {
        const sessionData = data as ClerkSessionEvent["data"];
        const userId = sessionData.user_id;
        
        console.log(`[Clerk Webhook] Session created for user: ${userId}`);

        // Check if user exists in our DB
        const existingUser = await db.user.findUnique({
          where: { id: userId },
        });
        
        if (!existingUser) {
          // User doesn't exist - fetch from Clerk and create
          console.log(`[Clerk Webhook] User ${userId} not in DB, fetching from Clerk...`);
          
          try {
            const client = await clerkClient();
            const clerkUser = await client.users.getUser(userId);
            const email = clerkUser.emailAddresses[0]?.emailAddress;
            
            if (email) {
              await db.user.create({
                data: {
                  id: userId,
                  email: email,
                  credits: 1000, // Welcome credits
                },
              });
              console.log(`[Clerk Webhook] ✅ Created user from session: ${userId} (${email})`);
            } else {
              console.error(`[Clerk Webhook] No email found for user: ${userId}`);
            }
          } catch (fetchError) {
            console.error(`[Clerk Webhook] Failed to fetch user from Clerk:`, fetchError);
          }
        } else {
          console.log(`[Clerk Webhook] ✅ Session created for existing user: ${userId}`);
        }
        break;
      }

      case "session.removed":
      case "session.ended": {
        // Just log these, no action needed
        const sessionData = data as ClerkSessionEvent["data"];
        console.log(`[Clerk Webhook] ${type}: user ${sessionData.user_id}`);
        break;
      }

      default:
        console.log(`[Clerk Webhook] Unhandled event type: ${type}`);
    }

    return NextResponse.json({ success: true, event: type });
  } catch (error) {
    console.error("[Clerk Webhook] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Clerk may send GET to verify endpoint
export async function GET() {
  return NextResponse.json({ 
    status: "ok", 
    provider: "clerk",
    message: "Clerk webhook endpoint is active",
  });
}
