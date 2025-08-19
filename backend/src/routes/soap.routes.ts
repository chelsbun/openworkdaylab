import express from "express";
import { Router } from "express";
import { XMLParser, XMLBuilder } from "fast-xml-parser";
import { prisma } from "../db/prisma.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const r = Router();
r.use(express.text({ type: ["text/xml", "application/xml", "+xml", "*/*"], limit: "5mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const wsdl = `<?xml version="1.0"?>
<definitions name="RaaSService"
  xmlns="http://schemas.xmlsoap.org/wsdl/"
  xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:tns="urn:openworkdaylab:raas"
  targetNamespace="urn:openworkdaylab:raas">
  <types>
    <xsd:schema targetNamespace="urn:openworkdaylab:raas" elementFormDefault="qualified">
      <xsd:element name="GetBenefitsCost">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="Dept" type="xsd:string" minOccurs="0"/>
            <xsd:element name="From" type="xsd:date" minOccurs="0"/>
            <xsd:element name="To" type="xsd:date" minOccurs="0"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
      <xsd:element name="GetBenefitsCostResponse">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="Items" minOccurs="0">
              <xsd:complexType>
                <xsd:sequence>
                  <xsd:element name="Item" maxOccurs="unbounded" minOccurs="0">
                    <xsd:complexType>
                      <xsd:sequence>
                        <xsd:element name="WorkerId" type="xsd:string"/>
                        <xsd:element name="FirstName" type="xsd:string"/>
                        <xsd:element name="LastName" type="xsd:string"/>
                        <xsd:element name="Department" type="xsd:string"/>
                        <xsd:element name="Salary" type="xsd:decimal"/>
                        <xsd:element name="YearsOfService" type="xsd:int"/>
                        <xsd:element name="BenefitsCost" type="xsd:decimal"/>
                        <xsd:element name="PctSalary" type="xsd:decimal"/>
                        <xsd:element name="TotalComp" type="xsd:decimal"/>
                      </xsd:sequence>
                    </xsd:complexType>
                  </xsd:element>
                </xsd:sequence>
              </xsd:complexType>
            </xsd:element>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
    </xsd:schema>
  </types>
  <message name="GetBenefitsCostRequest">
    <part name="parameters" element="tns:GetBenefitsCost"/>
  </message>
  <message name="GetBenefitsCostResponse">
    <part name="parameters" element="tns:GetBenefitsCostResponse"/>
  </message>
  <portType name="RaaSPortType">
    <operation name="GetBenefitsCost">
      <input message="tns:GetBenefitsCostRequest"/>
      <output message="tns:GetBenefitsCostResponse"/>
    </operation>
  </portType>
  <binding name="RaaSBinding" type="tns:RaaSPortType">
    <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
    <operation name="GetBenefitsCost">
      <soap:operation soapAction="urn:openworkdaylab:raas#GetBenefitsCost"/>
      <input><soap:body use="literal"/></input>
      <output><soap:body use="literal"/></output>
    </operation>
  </binding>
  <service name="RaaSService">
    <port name="RaaSPort" binding="tns:RaaSBinding">
      <soap:address location="http://localhost:8080/api/soap/raas"/>
    </port>
  </service>
</definitions>`;

r.get("/raas.wsdl", (_req, res) => {
  res.setHeader("Content-Type", "text/xml");
  res.send(wsdl);
});

const builder = new XMLBuilder({ ignoreAttributes: false, suppressEmptyNode: true, format: true });
const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });

async function queryBenefits(from?: string, to?: string, dept?: string) {
  const start = from ? new Date(from) : new Date("1970-01-01");
  const end = to ? new Date(to) : new Date();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `select 
        w."workerId",
        w."firstName",
        w."lastName",
        w."department",
        (w."salary")::numeric as salary,
        date_part('year', age(now(), w."hireDate"))::int as years_of_service,
        coalesce(sum(e."employeePrem" + e."employerPrem"),0)::numeric as benefits_cost,
        (coalesce(sum(e."employeePrem" + e."employerPrem"),0) / nullif(w."salary",0))::numeric as pct_salary,
        ((w."salary") + coalesce(sum(e."employeePrem" + e."employerPrem"),0))::numeric as total_comp
     from "Worker" w
     left join "Enrollment" e on e."workerId" = w."workerId"
       and e."effectiveDate" between $1 and $2
     ${dept ? `where w."department" = $3` : ""}
     group by w.id
     order by w."lastName" asc`,
    ...(dept ? [start, end, dept] : [start, end])
  );
  return rows;
}

r.post("/raas", async (req, res) => {
  try {
    const xml = req.body || "";
    const doc = parser.parse(xml);
    const body = doc?.Envelope?.Body || doc?.Body || {};
    const op = body?.GetBenefitsCost || body?.GetBenefitsCostRequest || {};
    const Dept = op?.Dept || undefined;
    const From = op?.From || undefined;
    const To = op?.To || undefined;

    const rows = await queryBenefits(From, To, Dept);
    const items = rows.map((r) => ({
      WorkerId: r.workerId,
      FirstName: r.firstName,
      LastName: r.lastName,
      Department: r.department,
      Salary: String(r.salary),
      YearsOfService: String(r.years_of_service),
      BenefitsCost: String(r.benefits_cost),
      PctSalary: String(r.pct_salary),
      TotalComp: String(r.total_comp),
    }));

    const payload = {
      "soapenv:Envelope": {
        "@_xmlns:soapenv": "http://schemas.xmlsoap.org/soap/envelope/",
        "@_xmlns:tns": "urn:openworkdaylab:raas",
        "soapenv:Body": { "tns:GetBenefitsCostResponse": { Items: { Item: items } } },
      },
    };

    res.setHeader("Content-Type", "text/xml; charset=utf-8");
    return res.send(builder.build(payload));
  } catch (err: any) {
    const fault = {
      "soapenv:Envelope": {
        "@_xmlns:soapenv": "http://schemas.xmlsoap.org/soap/envelope/",
        "soapenv:Body": { "soapenv:Fault": { faultcode: "soap:Server", faultstring: err?.message || "Unhandled error" } },
      },
    };
    res.setHeader("Content-Type", "text/xml; charset=utf-8");
    return res.status(500).send(builder.build(fault));
  }
});

export default r;
