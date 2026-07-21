import { Text } from "@react-email/components";
import { GameFacts } from "./game-facts";
import { KickOffEmail, emailStyles } from "./layout";
import { sendEmail } from "./send";

export type BookingCancelledProps = {
  to: string;
  venueName: string;
  venueAddress: string;
  kickoffLabel: string;
  refundedLabel: string | null; // null → inside 6 hours, no refund
  walletLabel: string;
  gameUrl: string;
};

export async function sendBookingCancelledEmail(props: BookingCancelledProps) {
  await sendEmail({
    to: props.to,
    subject: `Cancelled — ${props.kickoffLabel} at ${props.venueName}`,
    react: <BookingCancelledEmail {...props} />,
  });
}

export function BookingCancelledEmail(props: BookingCancelledProps) {
  return (
    <KickOffEmail
      preview={
        props.refundedLabel
          ? `${props.refundedLabel} is back in your wallet.`
          : "Your booking is cancelled."
      }
    >
      <Text style={emailStyles.heading}>Booking cancelled.</Text>
      {props.refundedLabel ? (
        <Text style={emailStyles.text}>
          <strong>{props.refundedLabel}</strong> went straight back to your
          KickOff wallet — your balance is now{" "}
          <strong>{props.walletLabel}</strong>. It&apos;ll count towards
          future features; refunds always land here.
        </Text>
      ) : (
        <Text style={emailStyles.text}>
          Because kickoff was less than 6 hours away, this one&apos;s
          non-refundable — as shown when you confirmed. Your spot has been
          released.
        </Text>
      )}
      <GameFacts
        venueName={props.venueName}
        venueAddress={props.venueAddress}
        kickoffLabel={props.kickoffLabel}
        gameUrl={props.gameUrl}
      />
    </KickOffEmail>
  );
}
