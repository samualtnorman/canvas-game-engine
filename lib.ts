export type TypeGuard<A, B extends A> = (x: A) => x is B

export class CustomError extends Error {
	name = this.constructor.name;

	constructor(message: string) {
		super(message);
	}
}

export class AssertError extends CustomError {
	constructor(message: string) {
		super(message);
	}
}

export function assert(value: any): asserts value

export function assert<
	A,
	B extends A
>(
	value: A,
	g1: TypeGuard<A, B>
): asserts value is B

export function assert<
	A,
	B extends A,
	C extends B
>(
	value: A,
	g1: TypeGuard<A, B>,
	g2: TypeGuard<B, C>
): asserts value is C

export function assert<
	A,
	B extends A,
	C extends B,
	D extends C
>(
	value: A,
	g1: TypeGuard<A, B>,
	g2: TypeGuard<B, C>,
	g3: TypeGuard<C, D>
): asserts value is D

export function assert(value: any, ...guards: Array<TypeGuard<any, any>>) {
	if (guards.length) {
		for (const guard of guards)
			if (!guard(value))
				throw new AssertError(`${guard.name || "assertion"} failed: got ${getType(value)}`)
	} else if (!value)
		throw new AssertError(`assertion failed: got ${getType(value)}`)
}

export function getType(value: any) {
	const typeofValue = typeof value

	if (typeofValue == "object") {
		if (!value)
			return "null"

		if (typeof value.constructor == "function" && value.constructor.name)
			return value.constructor.name
	}

	return typeofValue
}
