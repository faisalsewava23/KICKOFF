// Shared KickOff email shell. Email CSS is hostile territory: inline
// styles, table-safe structure, system-font fallbacks. Dark header with the
// logotype treatment, content card, minimal footer.
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

const FONT_STACK =
  "'Space Grotesk', 'Inter', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
export const ORANGE = "#FF4500";
const DARK = "#0A0A0A";
const MUTED = "#8C8C8C";

export const emailStyles = {
  heading: {
    margin: "0 0 12px",
    fontFamily: FONT_STACK,
    fontSize: "26px",
    lineHeight: "32px",
    fontWeight: 700 as const,
    color: DARK,
    letterSpacing: "-0.5px",
  },
  text: {
    margin: "0 0 16px",
    fontFamily: FONT_STACK,
    fontSize: "15px",
    lineHeight: "23px",
    color: "#333333",
  },
  factRow: {
    margin: "0 0 4px",
    fontFamily: FONT_STACK,
    fontSize: "15px",
    lineHeight: "23px",
    color: DARK,
  },
  muted: {
    margin: "16px 0 0",
    fontFamily: FONT_STACK,
    fontSize: "13px",
    lineHeight: "20px",
    color: MUTED,
  },
  button: {
    display: "inline-block",
    backgroundColor: ORANGE,
    color: "#FFFFFF",
    fontFamily: FONT_STACK,
    fontSize: "15px",
    fontWeight: 600 as const,
    textDecoration: "none",
    padding: "13px 28px",
    borderRadius: "10px",
  },
};

export function KickOffEmail({
  preview,
  children,
}: {
  preview: string;
  children: React.ReactNode;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, backgroundColor: "#F4F4F4", padding: "24px 12px" }}>
        <Container
          style={{
            maxWidth: "520px",
            margin: "0 auto",
            backgroundColor: "#FFFFFF",
            borderRadius: "14px",
            overflow: "hidden",
          }}
        >
          <Section style={{ backgroundColor: DARK, padding: "20px 28px" }}>
            <Text
              style={{
                margin: 0,
                fontFamily: FONT_STACK,
                fontSize: "20px",
                fontWeight: 700 as const,
                letterSpacing: "1px",
                color: ORANGE,
              }}
            >
              KICKOFF
            </Text>
          </Section>
          <Section style={{ padding: "28px" }}>{children}</Section>
        </Container>
        <Text
          style={{
            maxWidth: "520px",
            margin: "16px auto 0",
            fontFamily: FONT_STACK,
            fontSize: "12px",
            lineHeight: "18px",
            color: MUTED,
            textAlign: "center" as const,
          }}
        >
          You&apos;re receiving this because you have a KickOff account.
        </Text>
      </Body>
    </Html>
  );
}
