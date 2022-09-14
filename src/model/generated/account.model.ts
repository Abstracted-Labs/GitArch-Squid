import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, OneToMany as OneToMany_} from "typeorm"
import {IpsAccount} from "./ipsAccount.model"

@Entity_()
export class Account {
  constructor(props?: Partial<Account>) {
    Object.assign(this, props)
  }

  /**
   * Account address
   */
  @PrimaryColumn_()
  id!: string

  @Column_("text", {nullable: true})
  accountId!: string | undefined | null

  /**
   * IP sets this account has some level of access to via ownership or sub tokens
   */
  @OneToMany_(() => IpsAccount, e => e.account)
  ipSets!: IpsAccount[]
}
