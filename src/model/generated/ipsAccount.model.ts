import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_} from "typeorm"
import * as marshal from "./marshal"
import {Account} from "./account.model"
import {Ips} from "./ips.model"

@Entity_()
export class IpsAccount {
  constructor(props?: Partial<IpsAccount>) {
    Object.assign(this, props)
  }

  @PrimaryColumn_()
  id!: string

  @Index_()
  @ManyToOne_(() => Account, {nullable: true})
  account!: Account

  @Index_()
  @ManyToOne_(() => Ips, {nullable: true})
  ips!: Ips

  @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: true})
  tokenBalance!: bigint | undefined | null
}
