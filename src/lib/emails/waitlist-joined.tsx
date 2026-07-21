import { Text } from "@react-email/components";
import { GameFacts } from "./game-facts";
import { KickOffEmail, emailStyles } from "./layout";
import { sendEmail } from "./send";

export type WaitlistJoinedProps = {
  to: string;
  position: number | null;
  venueName: string;
  venueAddress: string;
  kickoffLabel: string;
  amountLabel: string;
  gameUrl: string;
};

export async function sendWaitlistJoinedEmail(props: WaitlistJoinedProps) {
  await sendEmail({
    to: props.to,
    subject: `You're ${props.position ? `#${props.position} ` : ""}on the waitlist — ${props.venueName}`,
    react: <WaitlistJoinedEmail {...props} />,
  });
}

export function WaitlistJoinedEmail(props: WaitlistJoinedProps) {
  return (
    <KickOffEmail
      preview={`If a spot opens, you're automatically in for ${props.amountLabel}.`}
    >
      <Text style={emailStyles.heading}>
        You&apos;re {props.position ? `#${props.position} ` : ""}on the
        waitlist.
      </Text>
      <Text style={emailStyles.text}>
        You haven&apos;t been charged. If a spot opens we&apos;ll charge{" "}
        <strong>{props.amountLabel}</strong> to your saved card and
        you&apos;re in — cancel your spot anytime before then, free.
      </Text>
      <GameFacts
        venueName={props.venueName}
        venueAddress={props.venueAddress}
        kickoffLabel={props.kickoffLabel}
        gameUrl={props.gameUrl}
      />
    </KickOffEmail>
  );
}
