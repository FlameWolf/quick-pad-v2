interface KVSchema {
	"google-access-token": string;
	"google-token-expires-at": number;
	"google-user-info": { email: string; name: string };
	"google-session-hint": boolean;
	"sort-by": string;
	"sort-direction": string;
	"auto-sync": boolean;
	"last-synced-to-local": string;
	"last-synced-to-cloud": string;
	"__migrated-to-idb": boolean;
}

type KVKey = keyof KVSchema;

interface TypeMap {
	bigint: bigint;
	boolean: boolean;
	date: Date;
	function: Function;
	json: string;
	number: number;
	object: object;
	string: string;
	symbol: symbol;
	undefined: undefined;
}

type Json = TypeMap[keyof TypeMap] | Json[] | { [key: keyof any]: Json };

type FromName<T extends keyof TypeMap> = TypeMap[T];

type LegalBlock = { type: "paragraph"; text: string } | { type: "list"; items: string[] };

interface LegalSection {
	heading: string;
	blocks: LegalBlock[];
}