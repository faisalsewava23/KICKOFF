import { Link, Text } from "@react-email/components";
import { GameFacts } from "./game-facts";
import { KickOffEmail, emailStyles } from "./layout";
import { sendEmail } from "./send";

export type ReminderProps = {
  to: string;
  venueName: string;
  venueAddress: string;
  kickoffLabel: string;
  confirmedCount: number;
  directionsUrl: string;
  gameUrl: string;
};

export async function sendReminderEmail(props: ReminderProps) {
  await sendEmail({
    to: props.to,
    subject: `Tomorrow: ${props.kickoffLabel} at ${props.venueName}`,
    react: <ReminderEmail {...props} />,
  });
}

export function ReminderEmail(props: ReminderProps) {
  return (
    <KickOffEmail preview={`Kickoff tomorrow at ${props.venueName}.`}>
      <Text style={emailStyles.heading}>Game tomorrow. Bring it.</Text>
      <Text style={emailStyles.text}>
        {props.confirmedCount} player{props.confirmedCount === 1 ? "" : "s"}{" "}
        confirmed so far. Boots, water, maybe a spare shirt.
      </Text>
      <GameFacts
        venueName={props.venueName}
        venueAddress={props.venueAddress}
        kickoffLabel={props.kickoffLabel}
        gameUrl={props.gameUrl}
      />
      <Text style={{ margin: "4px 0 0" }}>
        <Link href={props.directionsUrl} style={emailStyles.button}>
          Get directions
        </Link>
      </Text>
    </KickOffEmail>
  );
}
