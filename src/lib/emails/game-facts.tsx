import { Link, Section, Text } from "@react-email/components";
import { emailStyles } from "./layout";

export type GameFactsProps = {
  venueName: string;
  venueAddress: string;
  kickoffLabel: string; // e.g. "Wednesday 22 July, 18:00"
  gameUrl: string;
  extraRows?: { label: string; value: string }[];
};

export function GameFacts({
  venueName,
  venueAddress,
  kickoffLabel,
  gameUrl,
  extraRows = [],
}: GameFactsProps) {
  return (
    <Section
      style={{
        backgroundColor: "#F7F7F7",
        borderRadius: "10px",
        padding: "16px 20px",
        margin: "0 0 20px",
      }}
    >
      <Text style={{ ...emailStyles.factRow, fontWeight: 700 }}>
        {kickoffLabel}
      </Text>
      <Text style={emailStyles.factRow}>{venueName}</Text>
      <Text style={{ ...emailStyles.factRow, color: "#666666" }}>
        {venueAddress}
      </Text>
      {extraRows.map((row) => (
        <Text key={row.label} style={emailStyles.factRow}>
          {row.label}: <strong>{row.value}</strong>
        </Text>
      ))}
      <Text style={{ margin: "10px 0 0" }}>
        <Link
          href={gameUrl}
          style={{ ...emailStyles.factRow, color: "#FF4500", fontWeight: 600 }}
        >
          View the game →
        </Link>
      </Text>
    </Section>
  );
}
