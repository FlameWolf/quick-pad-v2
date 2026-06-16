import LegalPage from "@/components/LegalPage";
import { privacyIntro, privacySections } from "@/content/privacy";

export default function PrivacyPolicy() {
	return <LegalPage title="Privacy Policy" effectiveDate="12 June 2026" intro={privacyIntro} sections={privacySections}/>;
}