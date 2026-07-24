// AtoC 통합 플랜 §6.3 (감사 G2) — 정산 문서 PDF 렌더러.
//
// 🔴 단일 진실 원천: 이 파일은 **숫자를 만들지 않는다.** 값·라벨·행은 전부
//    documentLayout.ts의 statementDocumentModel()/invoiceDocumentModel()에서
//    오고, 인쇄 뷰(components/admin/ops-finance/*)가 그리는 것과 **같은 객체**다.
//    여기서 금액을 다시 더하거나 비율을 다시 곱하는 코드가 한 줄이라도 생기면
//    PDF와 화면이 갈라진다. 갈라진 PDF는 PDF가 없는 것보다 나쁘다.
//
// 🔴 DRAFT 워터마크(결정 4/D10): ops_finance_config.expert_reviewed가 명시적
//    true일 때만 사라진다. 모델의 `draft`를 그대로 따르므로 인쇄 뷰와 항상 같다.
//
// 🔴 D10: 생성·저장까지다. 이 모듈은 어디로도 보내지 않는다.
//
// 서버 전용 — @react-pdf/renderer는 node 렌더러이고 폰트를 파일시스템에서 읽는다.
// 클라이언트 컴포넌트에서 import 금지(그러면 프로덕션 빌드가 깨진다).

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer'
import type { InvoiceDoc, StatementDoc } from '../documents'
import {
  invoiceDocumentModel,
  statementDocumentModel,
  type DocEntityBlock,
  type DocMetaLine,
  type DocSummaryRow,
  type DocTable,
  type InvoiceDocumentModel,
  type StatementDocumentModel,
} from '../documentLayout'
import { PDF_FONT_FAMILY, registerPdfFonts } from './fonts.server'

const INK = '#171717'
const MUTED = '#525252'
const FAINT = '#a3a3a3'
const RULE = '#d4d4d4'
const HAIRLINE = '#ededed'

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 9,
    color: INK,
    paddingTop: 40,
    paddingBottom: 44,
    paddingHorizontal: 44,
    lineHeight: 1.45,
  },
  watermark: {
    position: 'absolute',
    top: 300,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 96,
    fontWeight: 700,
    color: '#171717',
    opacity: 0.07,
    transform: 'rotate(-24deg)',
  },
  kicker: { fontSize: 7.5, color: FAINT, letterSpacing: 1.6, fontWeight: 700 },
  title: { fontSize: 18, fontWeight: 700, marginTop: 4 },
  metaLine: { fontSize: 8, color: MUTED, marginTop: 4 },
  headerRule: { borderBottomWidth: 1, borderBottomColor: RULE, paddingBottom: 10 },
  row: { flexDirection: 'row' },
  entityGrid: { flexDirection: 'row', marginTop: 14, gap: 18 },
  entityCol: { flex: 1 },
  entityRole: { fontSize: 7.5, color: FAINT, fontWeight: 700 },
  entityName: { fontSize: 10, fontWeight: 700, marginTop: 3 },
  entityLine: { fontSize: 8, color: MUTED, marginTop: 2 },
  sectionHeading: { fontSize: 10, fontWeight: 700, marginTop: 18, marginBottom: 6 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    paddingVertical: 5,
  },
  summaryLabel: { fontSize: 8.5, color: MUTED, flex: 1 },
  summaryValue: { fontSize: 9.5, textAlign: 'right' },
  summaryValueStrong: { fontSize: 11.5, fontWeight: 700, textAlign: 'right' },
  summaryValueMuted: { fontSize: 8, color: MUTED, textAlign: 'right' },
  tableHead: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    paddingBottom: 4,
  },
  tableHeadCell: { fontSize: 7.5, color: MUTED, fontWeight: 700 },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
    paddingVertical: 4,
  },
  tableCell: { fontSize: 8 },
  tableEmpty: { fontSize: 8.5, color: FAINT, textAlign: 'center', paddingVertical: 18 },
  serviceBox: { backgroundColor: '#fafafa', padding: 12, marginTop: 16 },
  serviceTitle: { fontSize: 10, fontWeight: 700 },
  serviceSubtitle: { fontSize: 8, color: MUTED, marginTop: 3 },
  serviceAmount: { fontSize: 18, fontWeight: 700, textAlign: 'right' },
  serviceMeta: { fontSize: 8, color: MUTED, marginTop: 6 },
  footerGrid: { flexDirection: 'row', marginTop: 16, gap: 18 },
  noteBlock: { marginTop: 20, borderTopWidth: 1, borderTopColor: '#e5e5e5', paddingTop: 8 },
  note: { fontSize: 7.5, color: MUTED, marginTop: 2 },
  pageNumber: { position: 'absolute', bottom: 22, left: 0, right: 0, textAlign: 'center', fontSize: 7.5, color: FAINT },
})

/** 5-column order table: booking, date, gross, commission, remit/billed. */
const COLUMN_FLEX = [2.2, 1.5, 1.5, 1.5, 1.6]

function DraftWatermark() {
  // `fixed` repeats it on every page — a second page without the mark would
  // read as a final document.
  return (
    <Text style={styles.watermark} fixed>
      DRAFT
    </Text>
  )
}

function EntityColumn({ entity }: { entity: DocEntityBlock }) {
  return (
    <View style={styles.entityCol}>
      <Text style={styles.entityRole}>{entity.role}</Text>
      <Text style={styles.entityName}>{entity.name}</Text>
      <Text style={styles.entityLine}>{entity.address}</Text>
      <Text style={styles.entityLine}>{`${entity.idLabel}: ${entity.idValue}`}</Text>
    </View>
  )
}

function SummaryRow({ row }: { row: DocSummaryRow }) {
  const valueStyle =
    row.emphasis === 'strong'
      ? styles.summaryValueStrong
      : row.emphasis === 'muted'
        ? styles.summaryValueMuted
        : styles.summaryValue
  return (
    <View style={styles.summaryRow} wrap={false}>
      <Text style={styles.summaryLabel}>{row.label}</Text>
      <Text style={valueStyle}>{row.value}</Text>
    </View>
  )
}

function OrderTable({ table }: { table: DocTable }) {
  return (
    <View>
      <View style={styles.tableHead} fixed>
        {table.columns.map((column, index) => (
          <Text
            key={column}
            style={[
              styles.tableHeadCell,
              { flex: COLUMN_FLEX[index] ?? 1, textAlign: table.align[index] === 'right' ? 'right' : 'left' },
            ]}
          >
            {column}
          </Text>
        ))}
      </View>
      {table.rows.length === 0 ? (
        <Text style={styles.tableEmpty}>{table.emptyText}</Text>
      ) : (
        table.rows.map((row) => (
          <View key={row.key} style={styles.tableRow} wrap={false}>
            {row.cells.map((cell, index) => (
              <Text
                key={table.columns[index]}
                style={[
                  styles.tableCell,
                  {
                    flex: COLUMN_FLEX[index] ?? 1,
                    textAlign: table.align[index] === 'right' ? 'right' : 'left',
                    fontWeight: index === row.cells.length - 1 ? 700 : 400,
                  },
                ]}
              >
                {cell}
              </Text>
            ))}
          </View>
        ))
      )}
    </View>
  )
}

function MetaColumns({ lines }: { lines: DocMetaLine[] }) {
  return (
    <View style={styles.footerGrid}>
      {lines.map((line) => (
        <View key={line.label} style={styles.entityCol}>
          <Text style={styles.entityRole}>{line.label}</Text>
          <Text style={styles.entityLine}>{line.value}</Text>
        </View>
      ))}
    </View>
  )
}

function Notes({ notes }: { notes: string[] }) {
  return (
    <View style={styles.noteBlock}>
      {notes.map((note) => (
        <Text key={note} style={styles.note}>{`※ ${note}`}</Text>
      ))}
    </View>
  )
}

export function StatementPdf({ model }: { model: StatementDocumentModel }) {
  return (
    <Document title={`${model.title}`}>
      <Page size="A4" style={styles.page}>
        {model.draft ? <DraftWatermark /> : null}
        <View style={styles.headerRule}>
          <Text style={styles.kicker}>{model.kicker}</Text>
          <Text style={styles.title}>{model.title}</Text>
          <Text style={styles.metaLine}>{model.metaLine}</Text>
        </View>
        <View style={styles.entityGrid}>
          {model.entities.map((entity) => (
            <EntityColumn key={entity.role} entity={entity} />
          ))}
        </View>
        <Text style={styles.sectionHeading}>{model.summaryHeading}</Text>
        {model.summary.map((row) => (
          <SummaryRow key={row.key} row={row} />
        ))}
        <Text style={styles.sectionHeading}>{model.tableHeading}</Text>
        <OrderTable table={model.table} />
        <Notes notes={model.notes} />
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  )
}

export function InvoicePdf({ model }: { model: InvoiceDocumentModel }) {
  return (
    <Document title={`${model.screenTitle} ${model.invoiceNo}`}>
      <Page size="A4" style={styles.page}>
        {model.draft ? <DraftWatermark /> : null}
        <View style={[styles.headerRule, styles.row, { justifyContent: 'space-between' }]}>
          <View>
            <Text style={styles.kicker}>{model.kicker}</Text>
            <Text style={styles.title}>{model.invoiceNo}</Text>
          </View>
          <View>
            {model.headerMeta.map((line) => (
              <Text key={line.label} style={styles.metaLine}>{`${line.label}  ${line.value}`}</Text>
            ))}
          </View>
        </View>
        <View style={styles.entityGrid}>
          {model.entities.map((entity) => (
            <EntityColumn key={entity.role} entity={entity} />
          ))}
        </View>
        <View style={styles.serviceBox}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.serviceTitle}>{model.service.title}</Text>
              <Text style={styles.serviceSubtitle}>{model.service.subtitle}</Text>
            </View>
            <Text style={styles.serviceAmount}>{model.service.amountLabel}</Text>
          </View>
          <Text style={styles.serviceMeta}>{model.service.currencyLine}</Text>
          <Text style={styles.serviceMeta}>{model.service.agreementLine}</Text>
        </View>
        <Text style={styles.sectionHeading}>{model.tableHeading}</Text>
        <OrderTable table={model.table} />
        <MetaColumns lines={model.footer} />
        <Notes notes={model.notes} />
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  )
}

export async function renderStatementPdf(doc: StatementDoc): Promise<Buffer> {
  registerPdfFonts()
  return renderToBuffer(<StatementPdf model={statementDocumentModel(doc)} />)
}

export async function renderInvoicePdf(doc: InvoiceDoc): Promise<Buffer> {
  registerPdfFonts()
  return renderToBuffer(<InvoicePdf model={invoiceDocumentModel(doc)} />)
}
