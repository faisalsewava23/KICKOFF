import { Link, Text } from "@react-email/components";
import { KickOffEmail, emailStyles } from "./layout";
import { sendEmail } from "./send";

export type GameCancelledProps = {
  to: string;
  venueName: string;
  kickoffLabel: string;
  refundedLabel: string | null; // null → waitlisted player, hold released
  walletLabel: string | null;
  browseUrl: string;
};

export async function sendGameCancelledEmail(props: GameCancelledProps) {
  await sendEmail({
    to: props.to,
    subject: `Game off — ${props.kickoffLabel} at ${props.venueName} was cancelled`,
    react: <GameCancelledEmail {...props} />,
  });
}

export function GameCancelledEmail(props: GameCancelledProps) {
  return (
    <KickOffEmail
      preview={
        props.refundedLabel
          ? `Refunded in full: ${props.refundedLabel}.`
          : "The organiser cancelled — you were never charged."
      }
    >
      <Text style={emailStyles.heading}>Game off, sorry.</Text>
      <Text style={emailStyles.text}>
        The organiser cancelled{" "}
        <strong>
          {props.kickoffLabel} at {props.venueName}
        </strong>
        . Not the email anyone wants — here&apos;s where your money stands:
      </Text>
      {props.refundedLabel ? (
        <Text style={emailStyles.text}>
          <strong>{props.refundedLabel}</strong> — everything you paid — is
          back in your KickOff wallet
          {props.walletLabel ? (
            <>
              {" "}
              (balance now <strong>{props.walletLabel}</strong>)
            </>
          ) : null}
          .
        </Text>
      ) : (
        <Text style={emailStyles.text}>
          You were on the waitlist, so you were never charged — the hold on
          your card has been released.
        </Text>
      )}
      <Text style={{ margin: "20px 0 0" }}>
        <Link href={props.browseUrl} style={emailStyles.button}>
          Find another game
        </Link>
      </Text>
    </KickOffEmail>
  );
}
