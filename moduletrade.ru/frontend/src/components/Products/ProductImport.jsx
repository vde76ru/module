import React, { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Modal,
  Upload,
  Button,
  Steps,
  Table,
  Select,
  Card,
  Alert,
  Progress,
  Space,
  Typography,
  Divider,
  Row,
  Col,
  message,
  Checkbox,
  Tag,
  Tooltip,
  Switch
} from 'antd';
import {
  UploadOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  DownloadOutlined,
  ReloadOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { importProducts, fetchProducts } from 'store/productsSlice';
import axios from 'utils/axios';

const { Step } = Steps;
const { Option } = Select;
const { Title, Text } = Typography;
const { Dragger } = Upload;

const ProductImport = ({ visible, onClose }) => {
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.products);

  const [currentStep, setCurrentStep] = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [mappingConfig, setMappingConfig] = useState({});
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [importOptions, setImportOptions] = useState({
    updateExisting: true,
    createCategories: true,
    validatePrices: true,
    skipErrors: false
  });

  React.useEffect(() => {
    if (visible) {
      fetchDictionaries();
    }
  }, [visible]);

  const fetchDictionaries = async () => {
    try {
      const [suppliersRes, categoriesRes] = await Promise.all([
        axios.get('/api/dictionaries/suppliers'),
        axios.get('/api/dictionaries/categories')
      ]);
      setSuppliers(suppliersRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      message.error('Ошибка загрузки справочников');
    }
  };

  const handleFileUpload = {
    name: 'file',
    multiple: false,
    accept: '.xlsx,.xls,.csv',
    customRequest: async ({ file, onSuccess, onError }) => {
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await axios.post('/api/products/import/preview', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        setUploadedFile(file);
        setPreviewData(response.data.preview);
        
        // Автоматическое определение колонок
        const autoMapping = {};
        const headers = response.data.headers;
        
        const mappingRules = {
          'название': 'name',
          'наименование': 'name',
          'артикул': 'sku',
          'sku': 'sku',
          'цена': 'price',
          'стоимость': 'price',
          'описание': 'description',
          'категория': 'category',
          'бренд': 'brand',
          'вес': 'weight',
          'остаток': 'quantity',
          'количество': 'quantity'
        };

        headers.forEach((header, index) => {
          const lowerHeader = header.toLowerCase();
          for (const [pattern, field] of Object.entries(mappingRules)) {
            if (lowerHeader.includes(pattern)) {
              autoMapping[index] = field;
              break;
            }
          }
        });

        setMappingConfig(autoMapping);
        setCurrentStep(1);
        onSuccess(response.data);
      } catch (error) {
        message.error('Ошибка обработки файла');
        onError(error);
      }
    },
    onRemove: () => {
      setUploadedFile(null);
      setPreviewData([]);
      setMappingConfig({});
      setCurrentStep(0);
    }
  };

  const handleMapping = (columnIndex, field) => {
    setMappingConfig({
      ...mappingConfig,
      [columnIndex]: field
    });
  };

  const validateMapping = () => {
    const requiredFields = ['name', 'sku'];
    const mappedFields = Object.values(mappingConfig);
    
    const missingFields = requiredFields.filter(field => !mappedFields.includes(field));
    
    if (missingFields.length > 0) {
      message.error(`Необходимо указать соответствие для полей: ${missingFields.join(', ')}`);
      return false;
    }
    
    return true;
  };

  const proceedToImport = () => {
    if (!validateMapping()) return;
    if (!selectedSupplier) {
      message.error('Выберите поставщика');
      return;
    }
    
    setCurrentStep(2);
    performImport();
  };

  const performImport = async () => {
    try {
      const importData = {
        file_data: previewData,
        mapping: mappingConfig,
        supplier_id: selectedSupplier,
        options: importOptions
      };

      // Симуляция прогресса импорта
      const progressInterval = setInterval(() => {
        setImportProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 20;
        });
      }, 500);

      const response = await dispatch(importProducts(importData)).unwrap();
      
      clearInterval(progressInterval);
      setImportProgress(100);
      setImportResults(response);
      setCurrentStep(3);
      
      message.success('Импорт завершен успешно');
    } catch (error) {
      setImportProgress(0);
      message.error('Ошибка импорта: ' + (error.message || 'Неизвестная ошибка'));
    }
  };

  const handleClose = () => {
    setCurrentStep(0);
    setUploadedFile(null);
    setPreviewData([]);
    setMappingConfig({});
    setImportProgress(0);
    setImportResults(null);
    setSelectedSupplier(null);
    onClose();
  };

  const handleFinish = () => {
    dispatch(fetchProducts());
    handleClose();
  };

  const downloadTemplate = () => {
    window.open('/api/products/import/template', '_blank');
  };

  const availableFields = [
    { value: 'name', label: 'Название товара', required: true },
    { value: 'sku', label: 'Артикул', required: true },
    { value: 'description', label: 'Описание' },
    { value: 'price', label: 'Цена' },
    { value: 'category', label: 'Категория' },
    { value: 'brand', label: 'Бренд' },
    { value: 'weight', label: 'Вес' },
    { value: 'quantity', label: 'Количество' },
    { value: 'unit', label: 'Единица измерения' },
    { value: 'barcode', label: 'Штрихкод' }
  ];

  const previewColumns = previewData[0] ? Object.keys(previewData[0]).map((key, index) => ({
    title: (
      <div>
        <div>{key}</div>
        <Select
          size="small"
          placeholder="Выберите поле"
          value={mappingConfig[index]}
          onChange={(value) => handleMapping(index, value)}
          style={{ width: '100%', marginTop: 4 }}
          allowClear
        >
          {availableFields.map(field => (
            <Option key={field.value} value={field.value}>
              {field.label}
              {field.required && <Tag color="red" style={{ marginLeft: 4 }}>обязательно</Tag>}
            </Option>
          ))}
        </Select>
      </div>
    ),
    dataIndex: key,
    key: index,
    width: 200,
    render: (text) => (
      <Tooltip title={text}>
        <div style={{ 
          maxWidth: 150, 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {text}
        </div>
      </Tooltip>
    )
  })) : [];

  return (
    <Modal
      title="Импорт товаров"
      visible={visible}
      onCancel={handleClose}
      footer={null}
      width={1200}
      destroyOnClose
    >
      <Steps current={currentStep} style={{ marginBottom: 24 }}>
        <Step title="Загрузка файла" icon={<UploadOutlined />} />
        <Step title="Настройка соответствий" icon={<SettingOutlined />} />
        <Step title="Импорт" icon={<ReloadOutlined />} />
        <Step title="Результаты" icon={<CheckCircleOutlined />} />
      </Steps>

      {currentStep === 0 && (
        <div>
          <Alert
            message="Импорт товаров из файла"
            description="Поддерживаются файлы форматов: Excel (.xlsx, .xls), CSV. Максимальный размер файла: 10 МБ."
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
          
          <Row gutter={24}>
            <Col span={16}>
              <Dragger {...handleFileUpload} style={{ minHeight: 200 }}>
                <p className="ant-upload-drag-icon">
                  <FileExcelOutlined style={{ fontSize: 48 }} />
                </p>
                <p className="ant-upload-text">
                  Нажмите или перетащите файл в эту область для загрузки
                </p>
                <p className="ant-upload-hint">
                  Поддерживается только один файл за раз
                </p>
              </Dragger>
            </Col>
            <Col span={8}>
              <Card title="Полезные ссылки">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={downloadTemplate}
                    block
                  >
                    Скачать шаблон
                  </Button>
                  <Button type="link" block>
                    Инструкция по импорту
                  </Button>
                  <Button type="link" block>
                    Примеры файлов
                  </Button>
                </Space>
              </Card>
            </Col>
          </Row>
        </div>
      )}

      {currentStep === 1 && (
        <div>
          <Alert
            message="Настройка соответствий полей"
            description="Укажите, какие колонки вашего файла соответствуют полям товаров в системе"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Row gutter={24} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <Card title="Настройки импорта" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text strong>Поставщик:</Text>
                    <Select
                      placeholder="Выберите поставщика"
                      value={selectedSupplier}
                      onChange={setSelectedSupplier}
                      style={{ width: '100%', marginTop: 4 }}
                      showSearch
                    >
                      {suppliers.map(supplier => (
                        <Option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </Option>
                      ))}
                    </Select>
                  </div>
                </Space>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Опции импорта" size="small">
                <Space direction="vertical">
                  <Checkbox
                    checked={importOptions.updateExisting}
                    onChange={(e) => setImportOptions({
                      ...importOptions,
                      updateExisting: e.target.checked
                    })}
                  >
                    Обновлять существующие товары
                  </Checkbox>
                  <Checkbox
                    checked={importOptions.createCategories}
                    onChange={(e) => setImportOptions({
                      ...importOptions,
                      createCategories: e.target.checked
                    })}
                  >
                    Создавать новые категории
                  </Checkbox>
                  <Checkbox
                    checked={importOptions.validatePrices}
                    onChange={(e) => setImportOptions({
                      ...importOptions,
                      validatePrices: e.target.checked
                    })}
                  >
                    Проверять корректность цен
                  </Checkbox>
                  <Checkbox
                    checked={importOptions.skipErrors}
                    onChange={(e) => setImportOptions({
                      ...importOptions,
                      skipErrors: e.target.checked
                    })}
                  >
                    Пропускать записи с ошибками
                  </Checkbox>
                </Space>
              </Card>
            </Col>
          </Row>

          <Card title={`Предварительный просмотр (${previewData.length} строк)`}>
            <Table
              columns={previewColumns}
              dataSource={previewData.slice(0, 10)}
              pagination={false}
              scroll={{ x: true }}
              size="small"
            />
          </Card>

          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCurrentStep(0)}>
                Назад
              </Button>
              <Button
                type="primary"
                onClick={proceedToImport}
                disabled={!selectedSupplier}
              >
                Начать импорт
              </Button>
            </Space>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Title level={3}>Выполняется импорт товаров...</Title>
          <Progress
            type="circle"
            percent={Math.round(importProgress)}
            style={{ marginBottom: 24 }}
          />
          <div>
            <Text type="secondary">
              Обрабатываем ваши данные, пожалуйста подождите
            </Text>
          </div>
        </div>
      )}

      {currentStep === 3 && importResults && (
        <div>
          <Alert
            message="Импорт завершен"
            description={`Обработано ${importResults.total} записей`}
            type="success"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Row gutter={24}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Успешно импортировано"
                  value={importResults.success}
                  valueStyle={{ color: '#3f8600' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Обновлено"
                  value={importResults.updated}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="С ошибками"
                  value={importResults.errors}
                  valueStyle={{ color: '#cf1322' }}
                  prefix={<ExclamationCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Пропущено"
                  value={importResults.skipped}
                  valueStyle={{ color: '#d46b08' }}
                />
              </Card>
            </Col>
          </Row>

          {importResults.errorDetails && importResults.errorDetails.length > 0 && (
            <Card title="Ошибки импорта" style={{ marginTop: 16 }}>
              <Table
                dataSource={importResults.errorDetails}
                columns={[
                  { title: 'Строка', dataIndex: 'row', width: 80 },
                  { title: 'Поле', dataIndex: 'field', width: 120 },
                  { title: 'Значение', dataIndex: 'value', width: 150 },
                  { title: 'Ошибка', dataIndex: 'error' }
                ]}
                pagination={{ pageSize: 5 }}
                size="small"
              />
            </Card>
          )}

          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <Space>
              <Button onClick={handleClose}>
                Закрыть
              </Button>
              <Button type="primary" onClick={handleFinish}>
                Перейти к товарам
              </Button>
            </Space>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ProductImport;