import { Text } from "@react-email/components";
import { GameFacts } from "./game-facts";
import { KickOffEmail, emailStyles } from "./layout";
import { sendEmail } from "./send";

// The most important email in the app: the player wasn't looking when this
// happened. "You're in" energy first, then the receipt facts unmissable.
export type PromotedProps = {
  to: string;
  venueName: string;
  venueAddress: string;
  kickoffLabel: string;
  amountLabel: string;
  cardLabel: string; // e.g. "Visa ending 4242" or "your saved card"
  gameUrl: string;
};

export async function sendPromotedEmail(props: PromotedProps) {
  await sendEmail({
    to: props.to,
    subject: `A spot opened — you're in at ${props.venueName}`,
    react: <PromotedEmail {...props} />,
  });
}

export function PromotedEmail(props: PromotedProps) {
  return (
    <KickOffEmail
      preview={`You're off the waitlist. ${props.amountLabel} charged to ${props.cardLabel}.`}
    >
      <Text style={emailStyles.heading}>
        A spot opened up — you&apos;re in.
      </Text>
      <Text style={emailStyles.text}>
        Someone dropped out, you were next in line, and your spot is now
        locked in. See you there.
      </Text>
      <GameFacts
        venueName={props.venueName}
        venueAddress={props.venueAddress}
        kickoffLabel={props.kickoffLabel}
        gameUrl={props.gameUrl}
        extraRows={[
          { label: "Charged", value: props.amountLabel },
          { label: "Card", value: props.cardLabel },
        ]}
      />
      <Text style={emailStyles.text}>
        That&apos;s the amount you agreed to when you joined the waitlist,
        charged to your saved card as promised.
      </Text>
      <Text style={emailStyles.muted}>
        Can&apos;t make it after all? The normal rule now applies: cancel
        more than 6 hours before kickoff for a full refund to your KickOff
        wallet.
      </Text>
    </KickOffEmail>
  );
}
