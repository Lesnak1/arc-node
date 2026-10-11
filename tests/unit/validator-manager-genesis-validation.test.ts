// Copyright 2026 Circle Internet Group, Inc. All rights reserved.
//
// SPDX-License-Identifier: Apache-2.0

import { expect } from 'chai'
import { zeroAddress } from 'viem'
import { schemaValidatorManager } from '../../scripts/genesis/ValidatorManager'

const REGISTRY_ADMIN = '0x1111111111111111111111111111111111111111'
const PVM_ADMIN = '0x2222222222222222222222222222222222222222'
const OWNER = '0x3333333333333333333333333333333333333333'
const PAUSER = '0x4444444444444444444444444444444444444444'
const REGISTERER = '0x5555555555555555555555555555555555555555'
const CONTROLLER_A = '0x6666666666666666666666666666666666666666'
const CONTROLLER_B = '0x7777777777777777777777777777777777777777'

const PUBLIC_KEY_A = `0x${'11'.repeat(32)}`
const PUBLIC_KEY_B = `0x${'22'.repeat(32)}`

const validator = (
  publicKey: string,
  controller: string,
  votingPower: bigint,
  votingPowerLimit: bigint = 100n,
) => ({
  publicKey,
  votingPower,
  controllers: [
    {
      address: controller,
      votingPowerLimit,
    },
  ],
})

const configWithValidators = (
  validators: ReturnType<typeof validator>[],
  overrides?: {
    owner?: string
    pauser?: string
    validatorRegisterers?: string[]
  },
) => ({
  proxy: {
    admin: REGISTRY_ADMIN,
  },
  validators,
  PermissionedValidatorManager: {
    proxy: {
      admin: PVM_ADMIN,
    },
    owner: overrides?.owner ?? OWNER,
    pauser: overrides?.pauser ?? PAUSER,
    validatorRegisterers: overrides?.validatorRegisterers ?? [REGISTERER],
  },
})

describe('ValidatorManager genesis validator-set validation', () => {
  it('rejects an empty validator set', () => {
    const result = schemaValidatorManager.safeParse(configWithValidators([]))

    expect(result.success).to.be.false
  })

  it('rejects a validator set with no positive voting power', () => {
    const result = schemaValidatorManager.safeParse(
      configWithValidators([validator(PUBLIC_KEY_A, CONTROLLER_A, 0n), validator(PUBLIC_KEY_B, CONTROLLER_B, 0n)]),
    )

    expect(result.success).to.be.false
  })

  it('accepts a validator set with positive voting power', () => {
    const result = schemaValidatorManager.safeParse(configWithValidators([validator(PUBLIC_KEY_A, CONTROLLER_A, 20n)]))

    expect(result.success).to.be.true
  })

  it('accepts zero-power validators when another validator has positive power', () => {
    const result = schemaValidatorManager.safeParse(
      configWithValidators([validator(PUBLIC_KEY_A, CONTROLLER_A, 0n), validator(PUBLIC_KEY_B, CONTROLLER_B, 20n)]),
    )

    expect(result.success).to.be.true
  })
})

describe('ValidatorManager genesis invariant validation', () => {
  it('rejects negative voting power', () => {
    const result = schemaValidatorManager.safeParse(
      configWithValidators([validator(PUBLIC_KEY_A, CONTROLLER_A, -1n)]),
    )

    expect(result.success).to.be.false
  })

  it('rejects negative controller voting power limit', () => {
    const result = schemaValidatorManager.safeParse(
      configWithValidators([validator(PUBLIC_KEY_A, CONTROLLER_A, 20n, -1n)]),
    )

    expect(result.success).to.be.false
  })

  it('rejects zero address as owner', () => {
    const result = schemaValidatorManager.safeParse(
      configWithValidators([validator(PUBLIC_KEY_A, CONTROLLER_A, 20n)], { owner: zeroAddress }),
    )

    expect(result.success).to.be.false
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes('Owner cannot be the zero address'))).to.be.true
    }
  })

  it('rejects zero address as pauser', () => {
    const result = schemaValidatorManager.safeParse(
      configWithValidators([validator(PUBLIC_KEY_A, CONTROLLER_A, 20n)], { pauser: zeroAddress }),
    )

    expect(result.success).to.be.false
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes('Pauser cannot be the zero address'))).to.be.true
    }
  })

  it('rejects zero address in validatorRegisterers', () => {
    const result = schemaValidatorManager.safeParse(
      configWithValidators([validator(PUBLIC_KEY_A, CONTROLLER_A, 20n)], {
        validatorRegisterers: [REGISTERER, zeroAddress],
      }),
    )

    expect(result.success).to.be.false
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes('cannot be the zero address'))).to.be.true
    }
  })

  it('rejects duplicate validatorRegisterers with mixed casing', () => {
    const registererUpper = `0x${REGISTERER.slice(2).toUpperCase()}`
    const result = schemaValidatorManager.safeParse(
      configWithValidators([validator(PUBLIC_KEY_A, CONTROLLER_A, 20n)], {
        validatorRegisterers: [REGISTERER, registererUpper],
      }),
    )

    expect(result.success).to.be.false
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes('must be unique'))).to.be.true
    }
  })

  it('rejects zero address as controller address', () => {
    const result = schemaValidatorManager.safeParse(
      configWithValidators([validator(PUBLIC_KEY_A, zeroAddress, 20n)]),
    )

    expect(result.success).to.be.false
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes('cannot be the zero address'))).to.be.true
    }
  })

  it('rejects duplicate controllers across validators with mixed casing', () => {
    const controllerAUpper = `0x${CONTROLLER_A.slice(2).toUpperCase()}`
    const result = schemaValidatorManager.safeParse(
      configWithValidators([
        validator(PUBLIC_KEY_A, CONTROLLER_A, 20n),
        validator(PUBLIC_KEY_B, controllerAUpper, 10n),
      ]),
    )

    expect(result.success).to.be.false
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes('must be unique across all validators'))).to.be.true
    }
  })
})
