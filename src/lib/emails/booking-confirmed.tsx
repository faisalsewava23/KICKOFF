import { Text } from "@react-email/components";
import { GameFacts } from "./game-facts";
import { KickOffEmail, emailStyles } from "./layout";
import { sendEmail } from "./send";

export type BookingConfirmedProps = {
  to: string;
  venueName: string;
  venueAddress: string;
  kickoffLabel: string;
  amountLabel: string;
  gameUrl: string;
};

export async function sendBookingConfirmedEmail(props: BookingConfirmedProps) {
  await sendEmail({
    to: props.to,
    subject: `You're in — ${props.kickoffLabel} at ${props.venueName}`,
    react: <BookingConfirmedEmail {...props} />,
  });
}

export function BookingConfirmedEmail(props: BookingConfirmedProps) {
  return (
    <KickOffEmail preview={`Your spot's locked in at ${props.venueName}.`}>
      <Text style={emailStyles.heading}>You&apos;re in — see you there.</Text>
      <Text style={emailStyles.text}>
        Your spot&apos;s locked in. Turn up, play, done — payment&apos;s
        already sorted.
      </Text>
      <GameFacts
        venueName={props.venueName}
        venueAddress={props.venueAddress}
        kickoffLabel={props.kickoffLabel}
        gameUrl={props.gameUrl}
        extraRows={[{ label: "Paid", value: props.amountLabel }]}
      />
      <Text style={emailStyles.muted}>
        Plans changed? Cancel more than 6 hours before kickoff and the full
        amount goes back to your KickOff wallet.
      </Text>
    </KickOffEmail>
  );
}
