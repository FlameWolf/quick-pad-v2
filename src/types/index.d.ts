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

type FromName<T extends keyof TypeMap> = TypeMap[T];

type LegalBlock = { type: "paragraph"; text: string } | { type: "list"; items: string[] };

interface LegalSection {
	heading: string;
	blocks: LegalBlock[];
}