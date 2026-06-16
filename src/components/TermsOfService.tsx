import LegalPage from "@/components/LegalPage";
import { termsIntro, termsSections } from "@/content/terms";

export default function TermsOfService() {
	return <LegalPage title="Terms of Service" effectiveDate="12 June 2026" intro={termsIntro} sections={termsSections}/>;
}